import { Router } from 'express';
import { login, signup, getProfile, updateProfile, changePassword, verifySession } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);

router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.put('/change-password', authenticateToken, changePassword);
router.get('/verify', authenticateToken, verifySession);

export default router;
