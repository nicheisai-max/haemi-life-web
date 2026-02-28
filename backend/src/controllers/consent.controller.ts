import { Request, Response } from 'express';
import { consentRepository } from '../repositories/consent.repository';
import { sendError } from '../utils/response';

// Check if current user has signed the telemedicine consent
export const getConsentStatus = async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user) return sendError(res, 401, 'Unauthorized');

        if (user.role !== 'patient') {
            return res.status(403).json({ message: 'Only patients have telemedicine consent records.' });
        }

        const hasConsent = await consentRepository.hasConsent(user.id);
        res.json({ hasConsent });
    } catch (error) {
        console.error('Error fetching consent status:', error);
        res.status(500).json({ message: 'Error fetching consent status' });
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
            return res.status(403).json({ message: 'Only patients can sign telemedicine consent.' });
        }

        if (!signature) {
            return res.status(400).json({ message: 'Digital signature is required.' });
        }

        const record = await consentRepository.recordConsent(
            user.id,
            ipAddress as string,
            userAgent as string,
            signature as string,
            'v1.0'
        );

        res.status(201).json({
            message: 'Telemedicine consent signed successfully',
            record
        });
    } catch (error) {
        console.error('Error signing consent:', error);
        res.status(500).json({ message: 'Error signing telemedicine consent' });
    }
};
