import { Router } from 'express';
import { verifyPatientInviteToken } from '../controllers/doctor.controller';

/**
 * 🩺 HAEMI LIFE — PUBLIC INVITE TOKEN VERIFY
 *
 * Mounted at `/api/invites` in app.ts. Carries the single PUBLIC
 * (unauthenticated) endpoint of the invite system — the signup page
 * uses this to read a token's metadata (doctor name / specialization
 * + optional pre-fill fields) so the patient sees an accurate
 * "Invited by Dr. X" banner before they create their account.
 *
 * No PII beyond the patient's own pre-fill hints is exposed; the
 * doctor's contact details and the invite's full audit record stay
 * behind the authenticated doctor-only endpoints in doctor.routes.ts.
 */
const router = Router();

router.get('/:token', verifyPatientInviteToken);

export default router;
