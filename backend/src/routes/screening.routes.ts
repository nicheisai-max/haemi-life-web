import { Router } from 'express';
import * as screeningController from '../controllers/screening.controller';
import { authenticateToken } from '../middleware/auth.middleware';

/**
 * 🛡️ HAEMI LIFE: HEALTH SCREENING ROUTES (Unified)
 * Institutional Grade: Admin-level triage management + Patient-facing submission flow.
 * Standards: Google/Meta-grade TypeScript | Zero 'any' Policy.
 */

const router = Router();

// Apply global authentication guard
router.use(authenticateToken);

// ─── PATIENT / PUBLIC: Structured Clinical Flow ───────────────────────────────

// Read the platform-wide risk-calculation mode ('ai' | 'manual'). Patient
// clients gate their AI-preview call on this so a 'manual' platform never
// pays a Gemini round-trip during the booking form.
router.get('/risk-mode', screeningController.getPublicRiskMode);

// Fetch all active screening questions (display_order sorted — for patient UI)
router.get('/questions', screeningController.screeningController.getQuestions);

// Submit patient screening responses and calculate outcome (transactional)
router.post('/submit', screeningController.screeningController.submitScreening);

// ─── ADMIN: Dynamic Triage Definition Management ─────────────────────────────

// Fetch active definitions for patient-facing triage
router.get('/definitions', screeningController.getActiveQuestions);

// Fetch ALL definitions including inactive (admin only)
router.get('/definitions/all', screeningController.getAllQuestions);

// Create a new definition
router.post('/definitions', screeningController.createQuestion);

// Reorder definitions (must be before :id route to prevent match conflict)
router.patch('/definitions/reorder', screeningController.reorderQuestions);

// Update a specific definition
router.put('/definitions/:id', screeningController.updateQuestion);

// Toggle active status of a specific definition
router.patch('/definitions/:id/toggle', screeningController.toggleQuestionStatus);

// Delete a specific definition
router.delete('/definitions/:id', screeningController.deleteQuestion);

export default router;
