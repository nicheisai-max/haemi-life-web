
import { Router } from 'express';
import { clinicalCopilotController } from '../controllers/clinical-copilot.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { aiLimiter } from '../middleware/rate-limit.middleware'; // Import the specific rate limiter

const router = Router();

// POST /api/clinical-copilot/chat
// Protected: Only authenticated users with 'doctor' role
router.post(
    '/chat',
    aiLimiter,
    authenticateToken,
    authorizeRole(['doctor']),
    (req, res) => clinicalCopilotController.chat(req, res)
);

export default router;
