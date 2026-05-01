import { Request, Response } from 'express';
import { pool } from '../config/db';
import { preScreeningRepository, PreScreeningDefinition } from '../repositories/pre-screening.repository';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { auditService, SYSTEM_ANONYMOUS_ID } from '../services/audit.service';
import { PreScreeningResponse } from '../repositories/pre-screening.repository';
import {
    ScreeningQuestionRow,
    SubmitScreeningRequest,
    ScreeningOutcome,
    ScreeningQuestionResponse
} from '../types/screening.types';

/**
 * 🛡️ HAEMI LIFE: HEALTH SCREENING CONTROLLER (Unified)
 * Institutional Grade: Admin-level management of triage metadata + Patient submission flow.
 * Standards: Google/Meta-grade TypeScript | Zero 'any' Policy | Transactional Integrity.
 */

// ─── ADMIN: Dynamic Triage Definition Management ─────────────────────────────

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
    // P0 TYPE FIX (Phase 12): `appointment_id` is INTEGER in the database;
    // accept either numeric body or numeric-string and parse strictly.
    const { appointmentId, responses } = req.body as {
        appointmentId: string | number;
        responses: Array<{ questionId: string; responseValue: string | boolean }>
    };

    try {
        if (appointmentId === undefined || appointmentId === null || !responses || !Array.isArray(responses)) {
            sendError(res, 400, 'Appointment ID and valid responses are required.');
            return;
        }

        const parsedAppointmentId = typeof appointmentId === 'number'
            ? appointmentId
            : parseInt(appointmentId, 10);
        if (!Number.isInteger(parsedAppointmentId) || parsedAppointmentId <= 0) {
            sendError(res, 400, 'Appointment ID must be a positive integer.');
            return;
        }

        // 🛡️ INSTITUTIONAL NORMALIZATION (Google/Meta Grade)
        // Mapping camelCase frontend payload to strict snake_case repository requirements.
        const normalizedResponses: PreScreeningResponse[] = responses.map(r => ({
            question_id: r.questionId,
            response_value: typeof r.responseValue === 'boolean' ? r.responseValue : String(r.responseValue).toLowerCase() === 'true'
        }));

        const userId = req.user ? String(req.user.id) : SYSTEM_ANONYMOUS_ID;

        const result = await preScreeningRepository.saveResponses(parsedAppointmentId, userId, normalizedResponses);

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

// ─── PATIENT: Structured Clinical Submission (Transactional) ─────────────────

/**
 * screeningController object — patient-facing structured submission flow.
 * Uses direct pool connection for transactional integrity.
 */
export const screeningController = {
    /**
     * Fetch all active screening questions ordered by display_order
     */
    getQuestions: async (_req: Request, res: Response): Promise<void> => {
        const client = await pool.connect();
        try {
            const query = `
                SELECT id, disease_category, question_text_en, input_type, display_order 
                FROM screening_questions 
                WHERE is_active = TRUE 
                ORDER BY disease_category, display_order ASC
            `;
            
            const result = await client.query<ScreeningQuestionRow>(query);
            
            const questions: ScreeningQuestionResponse[] = result.rows.map(row => ({
                id: row.id,
                diseaseCategory: row.disease_category,
                questionTextEn: row.question_text_en,
                inputType: row.input_type,
                displayOrder: row.display_order
            }));

            sendResponse(res, 200, true, 'Questions fetched successfully', questions);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.error('[ScreeningController] Failed to fetch questions:', message);
            sendError(res, 500, 'Failed to fetch screening questions', 'FETCH_FAILURE', error);
        } finally {
            client.release();
        }
    },

    /**
     * Submit patient screening responses and compute outcome
     */
    submitScreening: async (req: Request, res: Response): Promise<void> => {
        const { appointmentId, responses } = req.body as SubmitScreeningRequest;
        const user = req.user;

        if (!user || !responses || Object.keys(responses).length === 0) {
            sendError(res, 400, 'Invalid submission: Unauthorized or missing responses', 'INVALID_INPUT');
            return;
        }

        const patientId = user.id;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Compute Outcome (Institutional Logic: ANY 'true' = PRESUMPTIVE)
            const hasPositiveSymptom = Object.values(responses).some(val => val === true);
            const outcome: ScreeningOutcome = hasPositiveSymptom ? 'PRESUMPTIVE' : 'NEGATIVE';

            // 2. Insert into patient_screening_records
            const recordQuery = `
                INSERT INTO patient_screening_records (patient_id, appointment_id, overall_outcome, responses)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `;
            const recordResult = await client.query<{ id: string }>(recordQuery, [
                patientId,
                appointmentId || null,
                outcome,
                JSON.stringify(responses)
            ]);
            
            const screeningRecordId = recordResult.rows[0].id;

            // 3. Insert individual responses into screening_responses for granular analytics
            const responseValues = Object.entries(responses);
            for (const [questionId, value] of responseValues) {
                const responseInsertQuery = `
                    INSERT INTO screening_responses (screening_record_id, question_id, response_value)
                    VALUES ($1, $2, $3)
                `;
                await client.query(responseInsertQuery, [screeningRecordId, questionId, value]);
            }

            await client.query('COMMIT');

            logger.info(`[ScreeningController] Screening submitted for patient ${patientId}. Outcome: ${outcome}`);

            sendResponse(res, 201, true, 'Screening submitted successfully', {
                screeningId: screeningRecordId,
                outcome,
                message: outcome === 'PRESUMPTIVE' 
                    ? 'Presumptive case detected. Please refer to contracted laboratory for evaluation.'
                    : 'Screening completed. No immediate symptoms detected.'
            });

        } catch (error: unknown) {
            await client.query('ROLLBACK');
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.error('[ScreeningController] Submission failed:', message);
            sendError(res, 500, 'Failed to process screening submission', 'SUBMISSION_FAILURE', error);
        } finally {
            client.release();
        }
    }
};
