import { Router } from 'express';
import * as screeningController from '../controllers/screening.controller';
import { authenticateToken } from '../middleware/auth.middleware';

/**
 * 🛡️ HAEMI LIFE: HEALTH SCREENING ROUTES
 * Institutional Grade: Admin-level API surface for dynamic triage management.
 */

const router = Router();

// Apply global authentication guard
router.use(authenticateToken);

// Clinical Triage Data Access
router.get('/definitions', screeningController.getActiveQuestions);
router.get('/definitions/all', screeningController.getAllQuestions);

// Admin-level Triage Management
router.post('/definitions', screeningController.createQuestion);
router.patch('/definitions/reorder', screeningController.reorderQuestions);
router.put('/definitions/:id', screeningController.updateQuestion);
router.patch('/definitions/:id/toggle', screeningController.toggleQuestionStatus);
router.delete('/definitions/:id', screeningController.deleteQuestion);

export default router;
