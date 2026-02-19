
import { Request, Response } from 'express';
import { clinicalCopilotService } from '../services/clinical-copilot.service';
import { sendResponse } from '../utils/response';
import { z } from 'zod';

// Input Validation Schema
const chatSchema = z.object({
    query: z.string().min(1, "Query is required").max(1000, "Query is too long"),
    context: z.any().optional(), // In a real app, strict schema for context is better
});

export class ClinicalCopilotController {

    // POST /api/clinical-copilot/chat
    async chat(req: Request, res: Response) {
        try {
            // 1. Validate Input
            const validation = chatSchema.safeParse(req.body);

            if (!validation.success) {
                return sendResponse(res, 400, false, 'Invalid input', validation.error.flatten());
            }

            const { query, context } = validation.data;

            // 2. Call Service
            // Note: In a real app, we might also want to log *who* is asking (req.user.id) for audit trails.
            const response = await clinicalCopilotService.generateResponse(query, context);

            // 3. Send Response
            return sendResponse(res, 200, true, 'AI Response Generated', { response });

        } catch (error) {
            console.error('[ClinicalCopilotController] Error:', error);
            return sendResponse(res, 500, false, 'Internal Server Error');
        }
    }
}

export const clinicalCopilotController = new ClinicalCopilotController();
