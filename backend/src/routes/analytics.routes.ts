import { Router } from 'express';
import { getGrowthStats } from '../controllers/analytics.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/growth', authenticateToken, getGrowthStats);

export default router;
