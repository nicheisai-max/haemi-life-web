/**
 * 🔒 HAEMI LIFE — INSTITUTIONAL FILE ROUTING (v2.0)
 * Standard: Google/Meta Enterprise Networking
 * Protocol: Domain-Aware Asset Resolution
 */

import { Router } from 'express';
import * as fileController from '../controllers/file.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

/**
 * 🖼️ PUBLIC ASSET RESOLUTION
 * Role: Profile identity rendering.
 */
router.get('/profile/:userId', fileController.getProfileImage);

/**
 * 🔒 SECURE ASSET RESOLUTION
 * Protocol: Authenticated Binary Stream via deliverFile helper.
 */
router.get('/message/:attachmentId', authenticateToken, fileController.getChatAttachment);
router.get('/record/:recordId', authenticateToken, fileController.getMedicalRecordFile);
router.get('/temp/:tempId', authenticateToken, fileController.getTempAttachment);

export default router;
