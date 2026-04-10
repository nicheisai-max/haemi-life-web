import { Router, type Request, type Response } from 'express';
import { getGrowthStats, getPerformanceStats } from '../controllers/analytics.controller';
import { authenticateToken as authenticate, restrictTo as authorize } from '../middleware/auth.middleware';

const router = Router();

/**
 * ─── INSTITUTIONAL ANALYTICS PIPELINE ────────────────────────────────────────
 *
 * RBAC Contract (Phase 14 — Zero-Drift Enforcement):
 *
 *   GET /growth      → 'doctor' | 'admin'
 *     Rationale: Growth stats are clinical volume data. Doctors need this for
 *     their "Clinical Reports" dashboard. Admins retain access for platform-level
 *     governance. The controller itself remains role-agnostic — it returns
 *     aggregate-only data with no PII, so widening RBAC here has zero
 *     data-leakage risk.
 *
 *   GET /performance → 'doctor'
 *     Rationale: Per-doctor KPIs. Controller enforces `req.user.id` scoping
 *     at the data layer (analyticsRepository.getClinicalPerformance(userId)).
 *     This ensures a doctor can never retrieve another doctor's stats.
 *
 *   GET /export      → 'doctor' | 'admin'
 *     Rationale: CSV export is role-scoped by the controller.
 *
 * All routes are gated behind `authenticate` (JWT + tokenVersion + session silos).
 */
router.use(authenticate);

// ─── Growth Visualization (Clinical Volume Trend) ────────────────────────────
// RBAC FIX (2026-04-09): Widened from authorize('admin') to authorize('doctor', 'admin').
// Root cause: Doctors on the Clinical Reports page were receiving 401 because the
// route guard was rejecting valid, authenticated doctor JWTs at the RBAC layer.
router.get('/growth', authorize('doctor', 'admin'), getGrowthStats);

// ─── Clinical KPI Dashboard (Per-Doctor Performance) ─────────────────────────
// Data isolation is enforced at the repository layer via req.user.id scoping.
router.get('/performance', authorize('doctor'), getPerformanceStats);

// ─── Secure CSV Export ────────────────────────────────────────────────────────
// TODO (Phase 15): Replace static stub with live DB-driven streaming export.
router.get('/export', authorize('doctor', 'admin'), (_req: Request, res: Response): void => {
    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', 'attachment; filename="clinical_export.csv"');
    res.write('Month,Value,NewUsers\n');
    res.write('Jan,100,50\n');
    res.write('Feb,120,60\n');
    res.end();
});

export default router;

