import { Request, Response } from 'express';
import { consentRepository } from '../repositories/consent.repository';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';

// Check if current user has signed the telemedicine consent
export const getConsentStatus = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const role = req.user?.role;

    try {
        if (!userId) return sendError(res, 401, 'Unauthorized');

        if (role !== 'patient') {
            return sendError(res, 403, 'Only patients have telemedicine consent records.');
        }

        const hasConsent = await consentRepository.hasConsent(userId);
        return sendResponse(res, 200, true, 'Consent status fetched', { hasConsent });
    } catch (error: unknown) {
        logger.error('Error fetching consent status:', {
            error: error instanceof Error ? error.message : String(error),
            userId
        });
        return sendError(res, 500, 'Error fetching consent status');
    }
};

// Sign telemedicine consent
export const signConsent = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { signature } = req.body as { signature?: string };

    try {
        if (!userId) return sendError(res, 401, 'Unauthorized');
        
        const ipAddress = (req.ip || req.headers['x-forwarded-for'] || 'unknown') as string;
        const userAgent = (req.headers['user-agent'] || 'unknown') as string;

        if (role !== 'patient') {
            return sendError(res, 403, 'Only patients can sign telemedicine consent.');
        }

        if (!signature) {
            return sendError(res, 400, 'Digital signature is required.');
        }

        const record = await consentRepository.recordConsent(
            userId,
            ipAddress,
            userAgent,
            signature,
            'v1.0'
        );

        return sendResponse(res, 201, true, 'Telemedicine consent signed successfully', record);
    } catch (error: unknown) {
        logger.error('Error signing consent:', {
            error: error instanceof Error ? error.message : String(error),
            userId
        });
        return sendError(res, 500, 'Error signing telemedicine consent');
    }
};
