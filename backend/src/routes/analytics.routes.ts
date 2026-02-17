import { Router } from 'express';
import { getGrowthStats } from '../controllers/analytics.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/growth', authenticateToken, requireRole('admin'), getGrowthStats);

export default router;
