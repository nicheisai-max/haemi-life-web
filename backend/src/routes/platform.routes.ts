import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import {
    getPlatformTimezoneEndpoint,
    updatePlatformTimezoneEndpoint,
    getClinicalCopilotEnabledEndpoint,
} from '../controllers/platform.controller';

/**
 * 🌍 HAEMI LIFE — PLATFORM ROUTES (Phase 5 — Timezone Sovereignty)
 *
 * Mounted at `/api/platform` in app.ts. Two endpoints with explicit
 * authorization scopes:
 *
 *   GET    /api/platform/timezone        → any authenticated user
 *   PATCH  /api/admin/platform/timezone  → admin role only
 *
 * The asymmetry is deliberate: every role's UI needs to READ the
 * platform timezone (so dates render correctly), but only admin can
 * WRITE it. The write path is mounted on a SEPARATE router under
 * `/api/admin/platform` in app.ts so the existing admin-only
 * middleware composition is reused without per-route role guards.
 */

const router = Router();

// Read-only endpoints — every authenticated role uses these to render
// platform-wide state correctly.
router.get('/timezone', authenticateToken, getPlatformTimezoneEndpoint);
router.get('/clinical-copilot-enabled', authenticateToken, getClinicalCopilotEnabledEndpoint);

export default router;

// ─── Admin-only sub-router ────────────────────────────────────────────────────
// Exported separately so `app.ts` can mount it under `/api/admin/platform`
// behind the admin-role middleware chain.
export const adminPlatformRouter = Router();
adminPlatformRouter.use(authenticateToken);
adminPlatformRouter.use(requireRole('admin'));
adminPlatformRouter.patch('/timezone', updatePlatformTimezoneEndpoint);
