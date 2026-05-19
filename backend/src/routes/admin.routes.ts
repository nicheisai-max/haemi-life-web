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
    getRiskCalculationMode,
    updateRiskCalculationMode,
    getHighRiskThreshold,
    updateHighRiskThreshold,
    updateClinicalCopilotEnabled,
    getSecurityEvents,
    getActiveSessions,
    revokeSession,
    getRevenueStats,
    getMonthlySignups,
    getSystemHealth
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
router.get('/settings/risk-calculation-mode', getRiskCalculationMode);
router.put('/settings/risk-calculation-mode', updateRiskCalculationMode);
// Pre-screening high-risk classification threshold (0-1). Admins can
// tune the boundary between `'completed'` and `'high-risk'` appointment
// statuses without a deploy. Reads + writes are both admin-only — the
// patient flow never surfaces this value, it only uses it internally.
router.get('/settings/high-risk-threshold', getHighRiskThreshold);
router.put('/settings/high-risk-threshold', updateHighRiskThreshold);
// Clinical Copilot kill switch — AI cost-control toggle.
// Read endpoint lives on `/api/platform/clinical-copilot-enabled`
// (open to every authenticated role; needed by doctor UI to render
// the chat in disabled state). The PUT below is admin-only.
router.put('/settings/clinical-copilot-enabled', updateClinicalCopilotEnabled);

// Security and Observability
router.get('/security-events', getSecurityEvents);
router.get('/active-sessions', getActiveSessions);
router.delete('/sessions/:sessionId', revokeSession);
router.get('/revenue-stats', getRevenueStats);
router.get('/monthly-signups', getMonthlySignups);
router.get('/system-health', getSystemHealth);

export default router;
