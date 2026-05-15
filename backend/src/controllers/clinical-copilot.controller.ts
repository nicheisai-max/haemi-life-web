import { Request, Response } from 'express';
import { clinicalCopilotService } from '../services/clinical-copilot.service';
import { auditService } from '../services/audit.service';
import { logger } from '../utils/logger';
import { getClinicalCopilotEnabled } from '../utils/config.util';
import { z } from 'zod';

/**
 * 🩺 HAEMI LIFE | INSTITUTIONAL AI COPILOT CONTROLLER
 * Standard: Google/Meta Grade TypeScript Execution
 * Model: gemini-2.5-pro (Architect-Mandated Contract)
 *
 * COST-CONTROL POSTURE (added 2026-05-15):
 *
 *   Every endpoint in this controller routes to Gemini 2.5 Pro and
 *   bills on every call. Two protections gate the dispatch:
 *
 *     1. ADMIN KILL SWITCH (`system_settings.clinical_copilot_enabled`)
 *        — when `false`, the request fails fast with HTTP 403 and a
 *        structured `COPILOT_DISABLED` error code BEFORE any Gemini
 *        call. The admin flips this from the Screening Manager page
 *        (`/admin/screening`).
 *
 *     2. PROACTIVE-INSIGHTS PATIENT CAP — the `patients` array on
 *        the proactive endpoint is bounded at
 *        `MAX_PROACTIVE_INSIGHTS_PATIENTS`. A larger list is
 *        rejected with HTTP 400, audit-logged as
 *        `PROACTIVE_INSIGHTS_REJECTED_OVERSIZE` so abuse attempts
 *        are forensically visible.
 *
 *   Both protections are backend-enforced (NOT UI-only). A bypass via
 *   curl, Postman, or a stale tab still hits the same guards.
 *
 * STRICT-TS POSTURE
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`.
 *   - All errors flow through `logger`. No `console.*`.
 *   - Toggle reads via `getClinicalCopilotEnabled()` are cached (5
 *     min) — the hot path doesn't slam the DB.
 */

// P0 Schema: Strict structure for Gemini 2.5 Pro History Sync
const historyItemSchema = z.object({
    role: z.enum(['user', 'model']),
    parts: z.array(z.object({
        text: z.string()
    }))
});
const chatSchema = z.object({
    message: z.string().min(1, "Message is required").max(15000, "Inference payload too large"),
    history: z.array(historyItemSchema).optional()
});

/**
 * Patient-list ceiling on `/proactive-insights`. Each patient row
 * adds ~400 tokens of prompt context; a 200-patient list inflates a
 * SINGLE Gemini call to ~80k tokens, ~40× the cost of a 5-patient
 * call. A doctor's realistic review batch is 5-15 patients — 20 is
 * a generous ceiling that keeps normal usage unblocked AND caps the
 * blast radius of any abuse attempt.
 */
const MAX_PROACTIVE_INSIGHTS_PATIENTS = 20 as const;

const proactiveSchema = z.object({
    patients: z.array(z.object({
        patientName: z.string(),
        appointmentTime: z.string(),
        riskCategory: z.enum(['Infectious', 'Chronic', 'Lifestyle']),
        severityScore: z.number(),
        keySymptoms: z.array(z.string())
    }))
});

const patientAnalysisSchema = z.object({
    responses: z.array(z.object({
        question: z.string(),
        answer: z.boolean()
    }))
});

/**
 * Standard envelope for the "copilot is disabled by admin" response.
 * Structured `code` so the frontend can match exactly and render
 * the "Contact administrator" banner without parsing free-text
 * `details`.
 */
const respondCopilotDisabled = (res: Response): Response => {
    return res.status(403).json({
        success: false,
        error: 'COPILOT_DISABLED',
        details: 'Clinical AI Copilot is currently disabled by your administrator. Please contact them for access.',
    });
};

export class ClinicalCopilotController {

    /**
     * POST /api/clinical-copilot/chat
     * Action: Initiates or continues 2.5 Pro consultation.
     * Contract: Strictly returns { success, reply } per Architect Directive.
     */
    async chat(req: Request, res: Response) {
        try {
            // 🔒 KILL SWITCH: refuse before any Gemini dispatch.
            if (!(await getClinicalCopilotEnabled())) {
                return respondCopilotDisabled(res);
            }

            // 🟢 VALIDATION: Institutional integrity check
            const validation = chatSchema.safeParse(req.body);

            if (!validation.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Malformed Payload',
                    details: validation.error.flatten()
                });
            }

            const { message, history } = validation.data;

            // 🩺 EXECUTION: Triggering the 2.5 Pro Inference Engine
            const responseText = await clinicalCopilotService.generateResponse(message, history);

            // 🔵 ARCHITECT SYNC: Unified Response Contract
            return res.status(200).json({
                success: true,
                reply: responseText
            });

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            logger.error('[ClinicalCopilotController] Gemini 2.5 Pro Execution Failed:', {
                error: errorMessage,
                userId: req.user?.id
            });

            // Forensic propagation of AI failure for frontend diagnostics
            return res.status(500).json({
                success: false,
                error: 'AI_INFERENCE_FAILURE',
                details: errorMessage
            });
        }
    }

    /**
     * POST /api/clinical-copilot/proactive-insights
     * Action: Generates proactive clinical alerts for the doctor.
     */
    async getProactiveInsights(req: Request, res: Response) {
        try {
            // 🔒 KILL SWITCH
            if (!(await getClinicalCopilotEnabled())) {
                return respondCopilotDisabled(res);
            }

            const validation = proactiveSchema.safeParse(req.body);

            if (!validation.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Malformed Payload',
                    details: validation.error.flatten()
                });
            }

            const { patients } = validation.data;

            // 🔒 PATIENT-LIST CAP: bounds the single-call token cost.
            // A doctor's realistic batch is 5-15 patients — 20 is a
            // generous ceiling. Anything over 20 is rejected without
            // a Gemini call and audit-logged so abuse is visible.
            if (patients.length > MAX_PROACTIVE_INSIGHTS_PATIENTS) {
                const userId: string | undefined = req.user?.id;
                if (typeof userId === 'string' && userId.length > 0) {
                    await auditService.log({
                        userId,
                        actorRole: req.user?.role,
                        action: 'PROACTIVE_INSIGHTS_REJECTED_OVERSIZE',
                        metadata: {
                            attempted: patients.length,
                            ceiling: MAX_PROACTIVE_INSIGHTS_PATIENTS,
                        },
                        ipAddress: req.ip,
                        userAgent: req.headers['user-agent'],
                    });
                }
                return res.status(400).json({
                    success: false,
                    error: 'PATIENT_LIMIT_EXCEEDED',
                    details: `Proactive insights accept up to ${MAX_PROACTIVE_INSIGHTS_PATIENTS} patients per request. Received ${patients.length}. Please batch your requests in groups of ${MAX_PROACTIVE_INSIGHTS_PATIENTS} or fewer.`,
                    ceiling: MAX_PROACTIVE_INSIGHTS_PATIENTS,
                });
            }

            const insights = await clinicalCopilotService.generateProactiveInsights(patients);

            return res.status(200).json({
                success: true,
                insights
            });

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('[ClinicalCopilotController] Proactive Insight Failed:', { error: errorMessage });

            return res.status(500).json({
                success: false,
                error: 'PROACTIVE_INSIGHT_FAILURE',
                details: errorMessage
            });
        }
    }

    /**
     * POST /api/clinical-copilot/analyze-patient-risk
     * Action: Analyzes patient pre-screening data and returns a health report.
     */
    async analyzePatientRisk(req: Request, res: Response) {
        try {
            // 🔒 KILL SWITCH
            if (!(await getClinicalCopilotEnabled())) {
                return respondCopilotDisabled(res);
            }

            const validation = patientAnalysisSchema.safeParse(req.body);

            if (!validation.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Malformed Payload',
                    details: validation.error.flatten()
                });
            }

            const { responses } = validation.data;
            const report = await clinicalCopilotService.analyzePatientRisk(responses);

            return res.status(200).json({
                success: true,
                report
            });

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('[ClinicalCopilotController] Patient Risk Analysis Failed:', { error: errorMessage });

            return res.status(500).json({
                success: false,
                error: 'PATIENT_ANALYSIS_FAILURE',
                details: errorMessage
            });
        }
    }
}

export const clinicalCopilotController = new ClinicalCopilotController();
/**
 * Re-export so the admin controller (or any other surface that needs
 * to advertise the cap to the UI) can read the same constant the
 * controller enforces — single source of truth.
 */
export { MAX_PROACTIVE_INSIGHTS_PATIENTS };
