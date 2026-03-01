import { Router } from 'express';
import { getMe } from '../controllers/profile.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route GET /api/profiles/me
 * @desc Get current user's profile with role-specific metadata
 * @access Private
 */
router.get('/me', authenticateToken, getMe);

export default router;
