import { Router } from 'express';
import { screeningController } from '../controllers/screening.controller';

const router = Router();

/**
 * Clinical Screening Routes
 * Institutional Grade | Zero 'any' Policy
 */

// Fetch all active screening questions (Ordering by display_order)
router.get('/questions', screeningController.getQuestions);

// Submit screening responses and calculate outcome
router.post('/submit', screeningController.submitScreening);

export default router;
