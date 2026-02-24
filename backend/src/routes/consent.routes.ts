import { Router } from 'express';
import { getConsentStatus, signConsent } from '../controllers/consent.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

// All consent routes require authentication
router.use(authenticateToken);

// Status check: open to any authenticated role (patients, doctors checking the gate)
router.get('/status', getConsentStatus);

// Signing consent: patients only
router.post('/', requireRole('patient'), signConsent);

export default router;
