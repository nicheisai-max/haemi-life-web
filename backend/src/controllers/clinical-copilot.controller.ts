import { Request, Response } from 'express';
import { clinicalCopilotService } from '../services/clinical-copilot.service';
import { logger } from '../utils/logger';
import { z } from 'zod';

/**
 * 🩺 HAEMI LIFE | INSTITUTIONAL AI COPILOT CONTROLLER
 * Standard: Google/Meta Grade TypeScript Execution
 * Model: gemini-2.5-pro (Architect-Mandated Contract)
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

export class ClinicalCopilotController {

    /**
     * POST /api/clinical-copilot/chat
     * Action: Initiates or continues 2.5 Pro consultation.
     * Contract: Strictly returns { success, reply } per Architect Directive.
     */
    async chat(req: Request, res: Response) {
        try {
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
            const validation = proactiveSchema.safeParse(req.body);

            if (!validation.success) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Malformed Payload', 
                    details: validation.error.flatten() 
                });
            }

            const { patients } = validation.data;
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
