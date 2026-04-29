import { Request, Response } from 'express';
import { preScreeningRepository, PreScreeningDefinition } from '../repositories/pre-screening.repository';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { auditService, SYSTEM_ANONYMOUS_ID } from '../services/audit.service';
import { PreScreeningResponse } from '../repositories/pre-screening.repository';

/**
 * 🛡️ HAEMI LIFE: HEALTH SCREENING CONTROLLER
 * Institutional Grade: Admin-level management of triage metadata.
 */

// Fetch all active screening questions for triage (Public/Patient)
export const getActiveQuestions = async (_req: Request, res: Response): Promise<void> => {
    try {
        const questions = await preScreeningRepository.getDefinitions('triage');
        sendResponse(res, 200, true, 'Active screening questions fetched successfully', questions);
    } catch (error: unknown) {
        logger.error('[ScreeningController] Fetch active failure:', { error: error instanceof Error ? error.message : String(error) });
        sendError(res, 500, 'Failed to fetch screening questions.');
    }
};

// Fetch all screening questions (Admin Only)
export const getAllQuestions = async (req: Request, res: Response): Promise<void> => {
    const user = req.user;
    try {
        if (!user || user.role !== 'admin') {
            sendError(res, 403, 'Access denied: Admin credentials required.');
            return;
        }

        const questions = await preScreeningRepository.getDefinitions();
        sendResponse(res, 200, true, 'All screening definitions fetched successfully', questions);
    } catch (error: unknown) {
        logger.error('[ScreeningController] Fetch all failure:', { error: error instanceof Error ? error.message : String(error) });
        sendError(res, 500, 'Failed to fetch all screening definitions.');
    }
};

// Create a new screening question (Admin Only)
export const createQuestion = async (req: Request, res: Response): Promise<void> => {
    const user = req.user;
    const data = req.body as Omit<PreScreeningDefinition, 'id'>;

    try {
        if (!user || user.role !== 'admin') {
            sendError(res, 403, 'Access denied: Admin credentials required.');
            return;
        }

        const question = await preScreeningRepository.createDefinition(data);

        await auditService.log({
            userId: String(user.id),
            action: 'SCREENING_QUESTION_CREATED',
            entityId: String(question.id),
            entityType: 'SCREENING_DEFINITION',
            metadata: { questionText: question.question_text }
        });

        sendResponse(res, 201, true, 'Screening question created successfully', question);
    } catch (error: unknown) {
        logger.error('[ScreeningController] Create failure:', { error: error instanceof Error ? error.message : String(error) });
        sendError(res, 500, 'Failed to create screening question.');
    }
};

// Update an existing question (Admin Only)
export const updateQuestion = async (req: Request, res: Response): Promise<void> => {
    const user = req.user;
    const { id } = req.params;
    const data = req.body as Partial<PreScreeningDefinition>;

    try {
        if (!id) {
            sendError(res, 400, 'Question ID is required.');
            return;
        }
        if (!user || user.role !== 'admin') {
            sendError(res, 403, 'Access denied: Admin credentials required.');
            return;
        }

        const updated = await preScreeningRepository.updateDefinition(String(id), data);

        if (!updated) {
            sendError(res, 404, 'Screening question not found.');
            return;
        }

        await auditService.log({
            userId: String(user.id),
            action: 'SCREENING_QUESTION_UPDATED',
            entityId: String(id),
            entityType: 'SCREENING_DEFINITION',
            metadata: { changes: data }
        });

        sendResponse(res, 200, true, 'Screening question updated successfully', updated);
    } catch (error: unknown) {
        logger.error('[ScreeningController] Update failure:', { error: error instanceof Error ? error.message : String(error) });
        sendError(res, 500, 'Failed to update screening question.');
    }
};

// Toggle question status (Admin Only)
export const toggleQuestionStatus = async (req: Request, res: Response): Promise<void> => {
    const user = req.user;
    const { id } = req.params;
    const { is_active } = req.body as { is_active: boolean };

    try {
        if (!id) {
            sendError(res, 400, 'Question ID is required.');
            return;
        }
        if (!user || user.role !== 'admin') {
            sendError(res, 403, 'Access denied: Admin credentials required.');
            return;
        }

        const updated = await preScreeningRepository.updateDefinition(String(id), { is_active });

        if (!updated) {
            sendError(res, 404, 'Screening question not found.');
            return;
        }

        await auditService.log({
            userId: String(user.id),
            action: is_active ? 'SCREENING_QUESTION_ACTIVATED' : 'SCREENING_QUESTION_DEACTIVATED',
            entityId: String(id),
            entityType: 'SCREENING_DEFINITION'
        });

        sendResponse(res, 200, true, `Question ${is_active ? 'activated' : 'deactivated'} successfully`, updated);
    } catch (error: unknown) {
        logger.error('[ScreeningController] Toggle failure:', { error: error instanceof Error ? error.message : String(error) });
        sendError(res, 500, 'Failed to toggle question status.');
    }
};

// Reorder screening questions (Admin Only)
export const reorderQuestions = async (req: Request, res: Response): Promise<void> => {
    const user = req.user;
    const updates = req.body.updates as { id: string; sort_order: number }[];

    try {
        if (!user || user.role !== 'admin') {
            sendError(res, 403, 'Access denied: Admin credentials required.');
            return;
        }

        if (!updates || !Array.isArray(updates)) {
            sendError(res, 400, 'Valid updates array is required.');
            return;
        }

        await preScreeningRepository.reorderDefinitions(updates);

        await auditService.log({
            userId: String(user.id),
            action: 'SCREENING_QUESTIONS_REORDERED',
            entityId: 'BATCH',
            entityType: 'SCREENING_DEFINITION',
            metadata: { count: updates.length }
        });

        sendResponse(res, 200, true, 'Screening questions reordered successfully');
    } catch (error: unknown) {
        logger.error('[ScreeningController] Reorder failure:', { error: error instanceof Error ? error.message : String(error) });
        sendError(res, 500, 'Failed to reorder screening questions.');
    }
};

// Delete a screening question (Admin Only)
export const deleteQuestion = async (req: Request, res: Response): Promise<void> => {
    const user = req.user;
    const { id } = req.params;

    try {
        if (!id) {
            sendError(res, 400, 'Question ID is required.');
            return;
        }
        if (!user || user.role !== 'admin') {
            sendError(res, 403, 'Access denied: Admin credentials required.');
            return;
        }

        const deleted = await preScreeningRepository.deleteDefinition(String(id));

        if (!deleted) {
            sendError(res, 404, 'Screening question not found.');
            return;
        }

        await auditService.log({
            userId: String(user.id),
            action: 'SCREENING_QUESTION_DELETED',
            entityId: String(id),
            entityType: 'SCREENING_DEFINITION'
        });

        sendResponse(res, 200, true, 'Screening question deleted successfully');
    } catch (error: unknown) {
        logger.error('[ScreeningController] Delete failure:', { error: error instanceof Error ? error.message : String(error) });
        sendError(res, 500, 'Failed to delete screening question.');
    }
};

// Save screening responses for an appointment (Patient/Public)
export const saveResponses = async (req: Request, res: Response): Promise<void> => {
    const { appointmentId, responses } = req.body as { 
        appointmentId: string; 
        responses: Array<{ questionId: string; responseValue: string | boolean }> 
    };

    try {
        if (!appointmentId || !responses || !Array.isArray(responses)) {
            sendError(res, 400, 'Appointment ID and valid responses are required.');
            return;
        }

        // 🛡️ INSTITUTIONAL NORMALIZATION (Google/Meta Grade)
        // Mapping camelCase frontend payload to strict snake_case repository requirements.
        const normalizedResponses: PreScreeningResponse[] = responses.map(r => ({
            question_id: r.questionId,
            response_value: typeof r.responseValue === 'boolean' ? r.responseValue : String(r.responseValue).toLowerCase() === 'true'
        }));

        const userId = req.user ? String(req.user.id) : SYSTEM_ANONYMOUS_ID;

        const result = await preScreeningRepository.saveResponses(appointmentId, userId, normalizedResponses);

        await auditService.log({
            userId,
            action: 'SCREENING_RESPONSES_SAVED',
            entityId: String(appointmentId),
            entityType: 'APPOINTMENT',
            metadata: { 
                responseCount: responses.length,
                healthScore: result.healthScore
            }
        });

        sendResponse(res, 200, true, 'Screening responses saved successfully', result);
    } catch (error: unknown) {
        logger.error('[ScreeningController] Save responses failure:', { 
            error: error instanceof Error ? error.message : String(error) 
        });
        sendError(res, 500, 'Failed to save screening responses.');
    }
};
