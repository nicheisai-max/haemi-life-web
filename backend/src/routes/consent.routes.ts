import { Router } from 'express';
import { getConsentStatus, signConsent } from '../controllers/consent.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Protect all consent routes, specifically for patients
router.use(authenticateToken);
router.use(requireRole('patient'));

router.get('/status', getConsentStatus);
router.post('/', signConsent);

export default router;
