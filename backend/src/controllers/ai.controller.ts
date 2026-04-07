import { Request, Response } from 'express';
import { clinicalCopilotService } from '../services/clinical-copilot.service';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { Content } from '@google/generative-ai'; // FIXED: Importing formal Content type

/**
 * 🩺 HAEMI LIFE | INSTITUTIONAL AI CONTROLLER
 * Standard: Google/Meta Grade TypeScript Execution (Strict-Type Consensus)
 * Model: gemini-2.5-pro (Force-Architected Contract)
 */

// P0 Schema: Forensic payload check for AI prompts
const aiPromptSchema = z.object({
    prompt: z.string().min(1, "Prompt is required").max(15000, "Prompt payload too large"),
    context: z.array(z.unknown()).optional() // FIXED: Replacing z.any() with z.unknown()
});

export class AIController {

    /**
     * POST /api/ai/ask
     * Action: Direct AI query to the 2.5 Pro inference engine.
     * Contract: Strictly returns { success, reply } for system alignment.
     */
    async ask(req: Request, res: Response) {
        try {
            // 🟢 VALIDATION: Institutional integrity check via Zod
            const validation = aiPromptSchema.safeParse(req.body);

            if (!validation.success) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Malformed Payload', 
                    details: validation.error.flatten() 
                });
            }

            const { prompt, context } = validation.data;

            // 🩺 EXECUTION: Primary SDK generation via 2.5 Pro Service
            // Institutional Sync: context is narrowed to Content[] for the SDK contract
            const responseText = await clinicalCopilotService.generateResponse(prompt, (context || []) as Content[]);

            // 🔵 ARCHITECT SYNC: Universal Response Contract
            return res.status(200).json({ 
                success: true, 
                reply: responseText 
            });

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            logger.error('[AI.Controller.ask] Gemini 2.5 Pro Generative AI Failure', {
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

export const aiController = new AIController();
