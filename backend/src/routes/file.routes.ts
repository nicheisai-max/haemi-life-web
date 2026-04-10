import { Router } from 'express';
import * as fileController from '../controllers/file.controller';
import { authenticateToken } from '../middleware/auth.middleware';


const router = Router();

// Public routes for profile images
router.get('/profile/:userId', fileController.getProfileImage);

// Authorized routes for chat and records
router.get('/message/:attachmentId', authenticateToken, fileController.getChatAttachment);
router.get('/record/:recordId', authenticateToken, fileController.getMedicalRecordFile);
router.get('/temp/:tempId', authenticateToken, fileController.getTempAttachment);


export default router;
