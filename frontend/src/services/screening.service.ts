import { api, normalizeResponse } from './api';
import { 
    ScreeningQuestion, 
    SubmitScreeningRequest, 
    SubmitScreeningResponse 
} from '../types/screening.types';
import { logger, auditLogger } from '../utils/logger';

/**
 * Clinical Screening Service
 * Handles all medical screening related API calls.
 * Institutional Grade | Zero 'any' Policy | Strict Audit Logging
 */
export const screeningService = {
    /**
     * Fetch all active screening questions from the backend
     */
    getQuestions: async (): Promise<ScreeningQuestion[]> => {
        try {
            const response = await api.get('/screening/questions');
            return normalizeResponse<ScreeningQuestion[]>(response);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown network failure';
            logger.error('[ScreeningService] Failed to fetch questions:', message);
            auditLogger.log('ERROR', { 
                context: 'ScreeningService.getQuestions',
                message
            });
            throw error;
        }
    },

    /**
     * Submit patient screening responses
     */
    submitScreening: async (data: SubmitScreeningRequest): Promise<SubmitScreeningResponse> => {
        try {
            const response = await api.post('/screening/submit', data);
            return normalizeResponse<SubmitScreeningResponse>(response);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown submission failure';
            logger.error('[ScreeningService] Submission failed:', message);
            auditLogger.log('ERROR', { 
                context: 'ScreeningService.submitScreening',
                message
            });
            throw error;
        }
    }
};
