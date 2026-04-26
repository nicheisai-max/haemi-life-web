import { Request, Response } from 'express';
import { pool } from '../config/db';
import { logger } from '../utils/logger';
import { 
    ScreeningQuestionRow, 
    SubmitScreeningRequest, 
    ScreeningOutcome,
    ScreeningQuestionResponse
} from '../types/screening.types';
import { sendResponse, sendError } from '../utils/response';

/**
 * Clinical Screening Controller
 * Institutional Grade | Zero 'any' Policy | Transactional Integrity
 */
export const screeningController = {
    /**
     * Fetch all active screening questions ordered by display_order
     */
    getQuestions: async (req: Request, res: Response): Promise<void> => {
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
