import { Router } from 'express';
import { aiController } from '../controllers/ai.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { aiLimiter } from '../middleware/rate-limit.middleware';

/**
 * 🩺 HAEMI LIFE | INSTITUTIONAL AI ROUTES
 * Standard: Google/Meta Grade TypeScript Execution
 * Endpoint: /api/ai
 */
const router = Router();

/**
 * POST /api/ai/ask
 * Protected: Requires Authentication (Doctor/Admin access standard)
 * Rate Limiting: aiLimiter (15 requests per 15 minutes)
 */
router.post(
    '/ask',
    aiLimiter,
    authenticateToken,
    authorizeRole(['doctor', 'admin']),
    (req, res) => aiController.ask(req, res)
);

export default router;
