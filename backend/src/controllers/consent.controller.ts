import { Request, Response } from 'express';
import { consentRepository } from '../repositories/consent.repository';
import { sendResponse, sendError } from '../utils/response';

// Check if current user has signed the telemedicine consent
export const getConsentStatus = async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user) return sendError(res, 401, 'Unauthorized');

        if (user.role !== 'patient') {
            return sendError(res, 403, 'Only patients have telemedicine consent records.');
        }

        const hasConsent = await consentRepository.hasConsent(user.id);
        sendResponse(res, 200, true, 'Consent status fetched', { hasConsent });
    } catch (error) {
        console.error('Error fetching consent status:', error);
        sendError(res, 500, 'Error fetching consent status');
    }
};

// Sign telemedicine consent
export const signConsent = async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user) return sendError(res, 401, 'Unauthorized');
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        const { signature } = req.body;

        if (user.role !== 'patient') {
            return sendError(res, 403, 'Only patients can sign telemedicine consent.');
        }

        if (!signature) {
            return sendError(res, 400, 'Digital signature is required.');
        }

        const record = await consentRepository.recordConsent(
            user.id,
            ipAddress as string,
            userAgent as string,
            signature as string,
            'v1.0'
        );

        sendResponse(res, 201, true, 'Telemedicine consent signed successfully', record);
    } catch (error) {
        console.error('Error signing consent:', error);
        sendError(res, 500, 'Error signing telemedicine consent');
    }
};
