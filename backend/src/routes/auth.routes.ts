import { Router } from 'express';
import { login, signup, getProfile, updateProfile, changePassword, verifySession, uploadProfileImage } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';
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
router.get('/verify', authenticateToken, verifySession);

export default router;
