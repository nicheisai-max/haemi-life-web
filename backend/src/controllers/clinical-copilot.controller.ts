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
}

export const clinicalCopilotController = new ClinicalCopilotController();
