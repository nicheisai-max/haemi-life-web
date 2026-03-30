import { Request, Response } from 'express';
import { clinicalCopilotService } from '../services/clinical-copilot.service';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { z } from 'zod';

// Input Validation Schema
const chatSchema = z.object({
    query: z.string().min(1, "Query is required").max(1000, "Query is too long"),
    context: z.record(z.string(), z.unknown()).optional(), 
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
            const response = await clinicalCopilotService.generateResponse(query, context);

            // 3. Send Response
            return sendResponse(res, 200, true, 'AI Response Generated', { response });

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage === 'SERVICE_UNAVAILABLE') {
                return sendResponse(res, 503, false, 'Clinical Copilot is currently overloaded. Please try again in a moment.');
            }
            logger.error('[ClinicalCopilotController] Error:', {
                error: errorMessage,
                userId: req.user?.id
            });
            return sendError(res, 500, 'Internal Server Error');
        }
    }
}

export const clinicalCopilotController = new ClinicalCopilotController();
