import { Router } from 'express';
import { login, signup, getProfile, updateProfile, changePassword, verifySession, getMe, uploadProfileImage, refreshToken, logout, heartbeat } from '../controllers/auth.controller';
import { authenticateToken, relaxedAuthenticateToken } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { validate } from '../middleware/validate.middleware';
import { loginSchema, signupSchema } from '../schemas/auth.schema';

const router = Router();

router.post('/signup', validate(signupSchema), signup);
router.post('/login', validate(loginSchema), login);


router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.post('/profile-image', authenticateToken, upload.single('image'), uploadProfileImage);
router.put('/change-password', authenticateToken, changePassword);
router.post('/refresh-token', refreshToken);
router.post('/logout', authenticateToken, logout);
router.get('/verify', authenticateToken, verifySession);
router.get('/heartbeat', authenticateToken, heartbeat);
router.get('/me', relaxedAuthenticateToken, getMe);

export default router;
