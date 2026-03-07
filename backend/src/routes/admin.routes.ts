import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import {
    getPendingVerifications,
    verifyDoctor,
    getAllUsers,
    updateUserStatus,
    getSystemStats,
    getAuditLogs,
    getSessionTimeout,
    updateSessionTimeout,
    getSecurityEvents,
    getActiveSessions,
    revokeSession,
    getRevenueStats
} from '../controllers/admin.controller';

const router = Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireRole('admin'));

router.get('/pending-verifications', getPendingVerifications);
router.put('/verify-doctor/:id', verifyDoctor);
router.get('/users', getAllUsers);
router.put('/users/:id/status', updateUserStatus);
router.get('/system-stats', getSystemStats);
router.get('/audit-logs', getAuditLogs);
router.get('/settings/session-timeout', getSessionTimeout);
router.put('/settings/session-timeout', updateSessionTimeout);

// Security and Observability
router.get('/security-events', getSecurityEvents);
router.get('/active-sessions', getActiveSessions);
router.delete('/sessions/:sessionId', revokeSession);
router.get('/revenue-stats', getRevenueStats);

export default router;
