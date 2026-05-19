import { Request, Response } from 'express';
import * as os from 'os';
import { pool } from '../config/db';
import { systemSettingsRepository } from '../repositories/system-settings.repository';
import {
    invalidateStringConfigCache,
    getPreScreeningHighRiskThreshold,
    DEFAULT_HIGH_RISK_THRESHOLD,
} from '../utils/config.util';
import { socketIO } from '../app';
import { securityRepository } from '../repositories/security.repository';
import { analyticsRepository } from '../repositories/analytics.repository';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { mapUserToResponse } from '../utils/user.mapper';
import { mapDoctorToResponse } from '../utils/doctor.mapper';
import { UserEntity, JoinedDoctorRow } from '../types/db.types';
import { decrypt } from '../utils/security';
import { emitToAdmins } from '../services/admin-broadcast.service';
import { auditService } from '../services/audit.service';
import {
    RISK_CALCULATION_MODE_KEY,
    DEFAULT_RISK_CALCULATION_MODE,
    isRiskCalculationMode,
    type RiskCalculationMode,
} from '../repositories/pre-screening.repository';

// Get pending doctor verifications (Admin only)
export const getPendingVerifications = async (req: Request, res: Response) => {
    const { originalUrl, ip } = req;
    logger.debug('[Admin] Fetching pending verifications', { url: originalUrl, from: ip });
    try {
        const result = await pool.query<JoinedDoctorRow>(`
            SELECT
                u.id, u.name, u.email, u.phone_number, u.profile_image, u.profile_image_mime, u.created_at,
                dp.specialization, dp.license_number, dp.years_of_experience, dp.bio,
                dp.consultation_fee, dp.can_video_consult
            FROM users u
            JOIN doctor_profiles dp ON u.id = dp.user_id
            WHERE u.role = 'doctor' AND dp.is_verified = false AND u.status = 'ACTIVE'
            ORDER BY u.created_at DESC
        `);

        const doctors = result.rows.map((row: JoinedDoctorRow) => {
            return mapDoctorToResponse({
                ...row,
                phone_number: row.phone_number ? decrypt(row.phone_number) : '',
                id_number: row.id_number ? decrypt(row.id_number) : null
            });
        });
        return sendResponse(res, 200, true, 'Pending verifications fetched', doctors);
    } catch (error: unknown) {
        logger.error('Error fetching pending verifications:', {
            error: error instanceof Error ? error.message : String(error)
        });
        return sendError(res, 500, 'Error fetching pending verifications');
    }
};

// Verify a doctor (Admin only)
export const verifyDoctor = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { verified } = req.body as { verified: boolean };
    const user = req.user;

    try {
        if (!user) return sendError(res, 401, 'Unauthorized');

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Update doctor verification status
            const result = await client.query(`
                UPDATE doctor_profiles
                SET is_verified = $1, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $2
                RETURNING *
            `, [verified, id]);

            if (result.rows.length === 0) {
                throw new Error('Doctor profile not found');
            }

            // Log the action
            if (!user) throw new Error('Invalid user session');

            await client.query(`
                INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                user.id,
                verified ? 'VERIFY_DOCTOR' : 'REJECT_DOCTOR',
                'doctor_profile',
                result.rows[0].id,
                JSON.stringify({ doctorUserId: id, verified })
            ]);

            await client.query('COMMIT');

            // Best-effort admin broadcast — the verified/rejected doctor
            // disappears from every admin's Verify Doctors page in real
            // time, and any admin who triggered the action also receives
            // the toast confirmation via the same event. Failures logged
            // inside `emitToAdmins` and do not propagate.
            const updatedRow: { id: string; user_id: string } | undefined = result.rows[0];
            if (updatedRow !== undefined) {
                emitToAdmins({
                    event: 'doctor:verified',
                    payload: {
                        profileId: String(updatedRow.id),
                        userId: String(updatedRow.user_id),
                        outcome: verified ? 'approved' : 'rejected',
                        verifiedBy: String(user.id),
                        timestamp: new Date().toISOString(),
                    },
                });
            }

            return sendResponse(res, 200, true, verified ? 'Doctor verified successfully' : 'Doctor rejected', {
                profile: mapDoctorToResponse(result.rows[0])
            });

        } catch (error: unknown) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch {
        logger.error('Error verifying doctor:', {
            adminId: user?.id
        });
        return sendError(res, 500, 'Error verifying doctor');
    }
};

/**
 * Get all users with server-side pagination and filters (Admin only)
 * Optimized for institutional scale and diagnostic performance.
 */
export const getAllUsers = async (req: Request, res: Response) => {
    const { originalUrl, ip } = req;
    try {
        const { role, status, search, page = '1', limit = '10' } = req.query;
        
        const pageNum = parseInt(page as string, 10);
        const limitNum = parseInt(limit as string, 10);
        const offset = (pageNum - 1) * limitNum;

        logger.debug('[Admin] Executing paginated user fetch', { 
            url: originalUrl, 
            from: ip, 
            params: { role, status, search, page: pageNum, limit: limitNum } 
        });

        // P0 SOFT-DELETE GUARD: admin user list must hide soft-deleted accounts.
        // Phase 4: surface `last_activity` so the admin User Management page
        // can render a live "Last seen X ago" cell. The column already
        // exists; the previous SELECT simply did not project it.
        let query = `
            SELECT
                id, name, email, phone_number, profile_image, profile_image_mime,
                role, status, initials, created_at, last_activity,
                COUNT(*) OVER() as total_count
            FROM users
            WHERE deleted_at IS NULL
        `;
        const params: (string | number | boolean | null)[] = [];

        if (typeof role === 'string' && role !== 'all') {
            params.push(role);
            query += ` AND role = $${params.length}`;
        }

        if (typeof status === 'string' && status !== 'all') {
            params.push(status.toUpperCase());
            query += ` AND status = $${params.length}`;
        }

        if (typeof search === 'string' && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            const idx = params.length;
            query += ` AND (name ILIKE $${idx} OR email ILIKE $${idx} OR phone_number ILIKE $${idx})`;
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limitNum, offset);

        const result = await pool.query<UserEntity & { total_count: string }>(query, params);
        
        const totalItems = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
        
        const users = result.rows.map((row) => {
            return mapUserToResponse({
                ...row,
                phone_number: row.phone_number ? decrypt(row.phone_number) : '',
                id_number: row.id_number ? decrypt(row.id_number) : null
            });
        });

        return sendResponse(res, 200, true, 'Users fetched successfully', {
            users,
            pagination: {
                total: totalItems,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(totalItems / limitNum)
            }
        });
    } catch (error: unknown) {
        logger.error('[Admin] Forensic Audit: Failed to fetch users', {
            url: originalUrl,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        return sendError(res, 500, 'Internal Server Error: Failed to retrieve user database');
    }
};

// Update user status (Admin only)
export const updateUserStatus = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body as { status: string };
    const user = req.user;

    try {
        if (!user) return sendError(res, 401, 'Unauthorized');

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Capture the previous status BEFORE the UPDATE so the live
            // admin broadcast carries an accurate `previousStatus` —
            // critical for downstream UI cues ("Activated" vs
            // "Deactivated") that cannot be inferred from `newStatus`
            // alone (e.g. ACTIVE → SUSPENDED is neither).
            const priorResult = await client.query<{ status: string }>(
                `SELECT status FROM users WHERE id = $1 FOR UPDATE`,
                [id]
            );
            const priorRow: { status: string } | undefined = priorResult.rows[0];
            if (priorRow === undefined) {
                throw new Error('User not found');
            }
            const previousStatus: string = priorRow.status;

            const result = await client.query<UserEntity>(`
                UPDATE users
                SET status = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING id, name, email, phone_number, profile_image, profile_image_mime,
                          role, status, initials, created_at, last_activity
            `, [status, id]);

            if (result.rows.length === 0) {
                throw new Error('User not found');
            }

            // Log the action
            if (!user) throw new Error('Invalid user session');

            await client.query(`
                INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                user.id,
                'UPDATE_USER_STATUS',
                'user',
                id,
                JSON.stringify({ previousStatus, newStatus: status })
            ]);

            await client.query('COMMIT');
            const updatedRow: UserEntity = result.rows[0];
            const updatedUser = {
                ...updatedRow,
                phone_number: updatedRow.phone_number ? decrypt(updatedRow.phone_number) : ''
            };

            // Best-effort admin broadcast — the row updates in-place on
            // every admin's User Management page in real time. Failures
            // logged inside `emitToAdmins` and never block the response.
            emitToAdmins({
                event: 'user:status_changed',
                payload: {
                    userId: updatedRow.id,
                    name: updatedRow.name,
                    email: updatedRow.email,
                    role: updatedRow.role,
                    previousStatus,
                    newStatus: updatedRow.status,
                    changedBy: String(user.id),
                    timestamp: new Date().toISOString(),
                },
            });

            return sendResponse(res, 200, true, 'User status updated', { user: mapUserToResponse(updatedUser) });
        } catch (error: unknown) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch {
        logger.error('Error updating user status:', {
            adminId: user?.id
        });
        return sendError(res, 500, 'Error updating user status');
    }
};

interface CountRow { count: string }

// Get system statistics (Admin only)
export const getSystemStats = async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Unauthorized');

        // P0 SOFT-DELETE GUARD: every count must exclude soft-deleted rows so
        // dashboard analytics reflect live state, not the historical superset.
        const stats = await Promise.all([
            pool.query<CountRow>("SELECT COUNT(*) FROM users WHERE role = $1 AND deleted_at IS NULL", ['patient']),
            pool.query<CountRow>("SELECT COUNT(*) FROM users WHERE role = $1 AND status = $2 AND deleted_at IS NULL", ['doctor', 'ACTIVE']),
            pool.query<CountRow>("SELECT COUNT(*) FROM doctor_profiles WHERE is_verified = false"),
            pool.query<CountRow>("SELECT COUNT(*) FROM appointments WHERE status = $1 AND deleted_at IS NULL", ['scheduled']),
            pool.query<CountRow>("SELECT COUNT(*) FROM prescriptions WHERE status = $1 AND deleted_at IS NULL", ['pending']),
            pool.query<CountRow>("SELECT COUNT(*) FROM users WHERE status = $1 AND deleted_at IS NULL", ['ACTIVE']),
            pool.query<CountRow>("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL")
        ]);

        return sendResponse(res, 200, true, 'System statistics fetched', {
            totalPatients: parseInt(stats[0].rows[0].count, 10),
            activeDoctors: parseInt(stats[1].rows[0].count, 10),
            pendingVerifications: parseInt(stats[2].rows[0].count, 10),
            scheduledAppointments: parseInt(stats[3].rows[0].count, 10),
            pendingPrescriptions: parseInt(stats[4].rows[0].count, 10),
            activeUsers: parseInt(stats[5].rows[0].count, 10),
            totalUsers: parseInt(stats[6].rows[0].count, 10)
        });
    } catch (error: unknown) {
        logger.error('Error fetching system stats:', {
            adminId: req.user?.id,
            error: error instanceof Error ? error.message : String(error),
        });
        return sendError(res, 500, 'Error fetching system stats');
    }
};

// Get audit logs (Admin only) — server-side filter + pagination
//
// Query params (all optional):
//   `limit`       page size (1-200, default 50)
//   `offset`      page offset (default 0)
//   `q`           free-text search across `action`, `entity_type`, `details`
//   `action`      exact match on the action verb (case-insensitive prefix match)
//   `entityType`  exact match on the entity_type
//
// Replaces the previous client-side full-load + filter pattern that broke
// past ~10k rows. The response shape now includes a `pagination.total`
// field so the UI can render an accurate "X of Y" footer.
//
// Strict-TS: every query param is narrowed from `unknown` (Express types
// `req.query` as `ParsedQs`, which is `string | ParsedQs | (string | ParsedQs)[] | undefined`)
// through dedicated narrowing helpers — no `as` casts, no implicit `any`.
const parseStringParam = (raw: unknown): string | null => {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    return trimmed.length === 0 ? null : trimmed;
};

const parseLimitParam = (raw: unknown, fallback: number, max: number): number => {
    if (typeof raw !== 'string') return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, max);
};

const parseOffsetParam = (raw: unknown, fallback: number): number => {
    if (typeof raw !== 'string') return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return parsed;
};

interface AuditLogRow {
    id: string;
    action: string;
    details: unknown;
    entity_type: string | null;
    entity_id: string | null;
    ip_address: string | null;
    created_at: Date;
    user_id: string;
    user_name: string | null;
    user_email: string | null;
    user_role: string | null;
}

export const getAuditLogs = async (req: Request, res: Response) => {
    const limit = parseLimitParam(req.query.limit, 50, 200);
    const offset = parseOffsetParam(req.query.offset, 0);
    const q = parseStringParam(req.query.q);
    const action = parseStringParam(req.query.action);
    const entityType = parseStringParam(req.query.entityType);

    try {
        // Compose the WHERE clause + parameter list dynamically. Each filter
        // appends a parameter so SQL injection is impossible — values flow
        // through `pg` parameter binding, never string interpolation.
        const whereClauses: string[] = [];
        const sqlParams: Array<string | number> = [];
        let paramIndex = 1;

        if (q !== null) {
            whereClauses.push(`(al.action ILIKE $${paramIndex} OR al.entity_type ILIKE $${paramIndex} OR al.details::text ILIKE $${paramIndex})`);
            sqlParams.push(`%${q}%`);
            paramIndex += 1;
        }
        if (action !== null) {
            whereClauses.push(`al.action ILIKE $${paramIndex}`);
            sqlParams.push(`${action}%`);
            paramIndex += 1;
        }
        if (entityType !== null) {
            whereClauses.push(`al.entity_type = $${paramIndex}`);
            sqlParams.push(entityType);
            paramIndex += 1;
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Total count (matching the same WHERE) for accurate pagination UI.
        // Computed in a second query rather than `COUNT(*) OVER ()` because
        // the latter forces a full materialisation under deep `audit_logs`
        // partitions; a separate count is faster on the existing index.
        const countResult = await pool.query<{ total: string }>(
            `SELECT COUNT(*)::text as total FROM audit_logs al ${whereSql}`,
            sqlParams
        );
        const totalRow: { total: string } | undefined = countResult.rows[0];
        const total: number = totalRow !== undefined ? Number.parseInt(totalRow.total, 10) : 0;

        // Page query with the same WHERE plus LIMIT/OFFSET appended.
        const limitIndex = paramIndex;
        const offsetIndex = paramIndex + 1;
        const rowsResult = await pool.query<AuditLogRow>(
            `SELECT
                al.id,
                al.action,
                al.details,
                al.entity_type,
                al.entity_id,
                al.ip_address,
                al.created_at,
                al.user_id,
                u.name as user_name,
                u.email as user_email,
                u.role as user_role
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ${whereSql}
            ORDER BY al.created_at DESC
            LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
            [...sqlParams, limit, offset]
        );

        const auditLogs = rowsResult.rows.map((row: AuditLogRow) => ({
            id: row.id,
            userId: row.user_id,
            action: row.action,
            details: row.details,
            entityType: row.entity_type,
            entityId: row.entity_id,
            ipAddress: row.ip_address,
            createdAt: row.created_at,
            userName: row.user_name,
            userEmail: row.user_email,
            userRole: row.user_role,
        }));

        return sendResponse(res, 200, true, 'Audit logs fetched', {
            items: auditLogs,
            pagination: {
                total,
                limit,
                offset,
            },
        });
    } catch (error: unknown) {
        logger.error('Error fetching audit logs:', {
            error: error instanceof Error ? error.message : String(error),
            adminId: req.user?.id,
            limit,
            offset,
            q,
            action,
            entityType,
        });
        return sendError(res, 500, 'Error fetching audit logs');
    }
};

// Get current session timeout (Admin only)
export const getSessionTimeout = async (_req: Request, res: Response) => {
    try {
        const timeout = await systemSettingsRepository.getSetting('SESSION_TIMEOUT_MINUTES');
        return sendResponse(res, 200, true, 'Session timeout fetched', { timeout: parseInt(timeout || '60', 10) });
    } catch (error: unknown) {
        logger.error('Error fetching session timeout:', {
            error: error instanceof Error ? error.message : String(error)
        });
        return sendError(res, 500, 'Error fetching session timeout');
    }
};

// Update session timeout (Admin only)
export const updateSessionTimeout = async (req: Request, res: Response) => {
    try {
        const { timeout } = req.body as { timeout: string };

        const timeoutNum = parseInt(timeout, 10);
        if (isNaN(timeoutNum) || timeoutNum < 5 || timeoutNum > 1440) {
            return sendError(res, 400, 'Invalid timeout value. Must be between 5 and 1440 minutes.');
        }

        await systemSettingsRepository.updateSetting('SESSION_TIMEOUT_MINUTES', timeoutNum.toString());

        return sendResponse(res, 200, true, 'Session timeout updated successfully', { timeout: timeoutNum });
    } catch (error: unknown) {
        logger.error('Error updating session timeout:', {
            error: error instanceof Error ? error.message : String(error)
        });
        return sendError(res, 500, 'Error updating session timeout');
    }
};

/**
 * Returns the current platform-wide pre-screening risk-calculation mode
 * (`'ai'` or `'manual'`). Defaults to `'manual'` when no row exists.
 * Admin-only. Mirrors the session-timeout pattern above.
 */
export const getRiskCalculationMode = async (_req: Request, res: Response) => {
    try {
        const raw = await systemSettingsRepository.getSetting(RISK_CALCULATION_MODE_KEY);
        const mode: RiskCalculationMode = isRiskCalculationMode(raw)
            ? raw
            : DEFAULT_RISK_CALCULATION_MODE;
        return sendResponse(res, 200, true, 'Risk calculation mode fetched', { mode });
    } catch (error: unknown) {
        logger.error('Error fetching risk calculation mode', {
            error: error instanceof Error ? error.message : String(error),
        });
        return sendError(res, 500, 'Error fetching risk calculation mode');
    }
};

/**
 * Updates the platform-wide pre-screening risk-calculation mode. Admin
 * only. Validates the supplied mode against the typed union; rejects
 * anything else as 400.
 *
 * Post-write side effects:
 *   1. Invalidate the 5-min config cache so the very next patient
 *      submission reads the freshly-written row, not a stale cache.
 *   2. Audit log with prior + new mode, IP, user agent — HIPAA-equivalent
 *      attribution for clinical configuration changes.
 *   3. Broadcast `'risk-mode:changed'` to every connected socket so
 *      patient-side booking forms can re-fetch their mode preview
 *      instantly (matches the `clinical-copilot:toggled` pattern).
 */
export const updateRiskCalculationMode = async (req: Request, res: Response) => {
    try {
        const adminId = req.user?.id;
        if (!adminId) return sendError(res, 401, 'Unauthorized');

        const { mode } = req.body as { mode?: unknown };
        if (typeof mode !== 'string' || !isRiskCalculationMode(mode)) {
            return sendError(res, 400, 'Invalid mode. Expected "ai" or "manual".');
        }

        const priorRaw = await systemSettingsRepository.getSetting(RISK_CALCULATION_MODE_KEY);
        const priorMode: RiskCalculationMode = isRiskCalculationMode(priorRaw)
            ? priorRaw
            : DEFAULT_RISK_CALCULATION_MODE;

        await systemSettingsRepository.updateSetting(RISK_CALCULATION_MODE_KEY, mode);

        // Drop the cached value so the next call to
        // `getPreScreeningRiskMode()` reads the freshly-written row
        // instead of the stale 5-minute cache.
        invalidateStringConfigCache(RISK_CALCULATION_MODE_KEY);

        await auditService.log({
            userId: adminId,
            actorRole: req.user?.role,
            action: 'RISK_CALCULATION_MODE_CHANGED',
            entityType: 'SYSTEM_SETTINGS',
            entityId: RISK_CALCULATION_MODE_KEY,
            metadata: { priorMode, newMode: mode },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });

        // Broadcast globally — patient booking forms read this value
        // on mount and re-fetch on this event so a mid-session admin
        // flip never leaves a stale preview on screen. Failure-tolerant:
        // a missing socketIO logs at debug and continues; the DB write
        // is the source of truth, the broadcast is a UX accelerator.
        try {
            if (socketIO !== undefined) {
                socketIO.emit('risk-mode:changed', { mode });
            } else {
                logger.debug('[RiskMode] socketIO not ready; skipping real-time broadcast');
            }
        } catch (broadcastError: unknown) {
            logger.warn('[RiskMode] Broadcast emit failed; DB write succeeded', {
                error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError),
            });
        }

        return sendResponse(res, 200, true, 'Risk calculation mode updated', { mode });
    } catch (error: unknown) {
        logger.error('Error updating risk calculation mode', {
            error: error instanceof Error ? error.message : String(error),
        });
        return sendError(res, 500, 'Error updating risk calculation mode');
    }
};

/**
 * HAEMI LIFE — PRE-SCREENING HIGH-RISK THRESHOLD (Enterprise Hardening)
 *
 * GET — returns the current platform-wide threshold in `[0, 1]` used by
 * the pre-screening repository to classify submissions as `'high-risk'`
 * vs `'completed'`. Defaults to `0.7` when no row exists (the prior
 * hardcoded value, preserved exactly).
 *
 * PUT — admin-only update. Validates the body is `{ threshold: number }`
 * with `0 <= threshold <= 1`. Persists, invalidates the config cache,
 * audit logs with prior + new + IP + UA, and emits an admin event so
 * other admin tabs reflect the change immediately.
 */
const HIGH_RISK_THRESHOLD_KEY = 'pre_screening_high_risk_threshold' as const;

export const getHighRiskThreshold = async (_req: Request, res: Response) => {
    try {
        const threshold: number = await getPreScreeningHighRiskThreshold();
        return sendResponse(res, 200, true, 'High-risk threshold fetched', { threshold });
    } catch (error: unknown) {
        logger.error('Error fetching high-risk threshold', {
            error: error instanceof Error ? error.message : String(error),
        });
        return sendError(res, 500, 'Error fetching high-risk threshold');
    }
};

export const updateHighRiskThreshold = async (req: Request, res: Response) => {
    try {
        const adminId = req.user?.id;
        if (!adminId) return sendError(res, 401, 'Unauthorized');

        const body: unknown = req.body;
        if (
            typeof body !== 'object'
            || body === null
            || !('threshold' in body)
            || typeof (body as { threshold: unknown }).threshold !== 'number'
        ) {
            return sendError(res, 400, 'Invalid body. Expected { threshold: number }.');
        }
        const candidate: number = (body as { threshold: number }).threshold;
        if (!Number.isFinite(candidate) || candidate < 0 || candidate > 1) {
            return sendError(res, 400, 'Threshold must be a finite number in [0, 1].');
        }

        const priorThreshold: number = await getPreScreeningHighRiskThreshold();
        await systemSettingsRepository.updateSetting(HIGH_RISK_THRESHOLD_KEY, String(candidate));
        invalidateStringConfigCache(HIGH_RISK_THRESHOLD_KEY);

        const adminRole: string = typeof req.user?.role === 'string' ? req.user.role : 'admin';

        await auditService.log({
            userId: adminId,
            actorRole: adminRole,
            action: 'PRE_SCREENING_HIGH_RISK_THRESHOLD_CHANGED',
            entityType: 'SYSTEM_SETTINGS',
            entityId: HIGH_RISK_THRESHOLD_KEY,
            metadata: { priorThreshold, newThreshold: candidate, defaultThreshold: DEFAULT_HIGH_RISK_THRESHOLD },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });

        // Admin-room broadcast — every admin tab observing screening
        // settings re-renders the new threshold without a page reload.
        // Patients are unaffected (the threshold is server-side; their
        // UI does not surface it).
        emitToAdmins({
            event: 'screening:threshold-changed',
            payload: {
                priorThreshold,
                newThreshold: candidate,
                actorId: adminId,
                actorRole: 'admin',
                timestamp: new Date().toISOString(),
            },
        });

        return sendResponse(res, 200, true, 'High-risk threshold updated', { threshold: candidate });
    } catch (error: unknown) {
        logger.error('Error updating high-risk threshold', {
            error: error instanceof Error ? error.message : String(error),
        });
        return sendError(res, 500, 'Error updating high-risk threshold');
    }
};

// ─── Clinical Copilot Kill Switch (AI cost-control) ───────────────────────────
//
// The Clinical AI Copilot routes to Gemini 2.5 Pro on every doctor chat,
// proactive-insights batch, and patient risk analysis — each one is a
// billable event. This pair of admin-only endpoints exposes the kill
// switch stored in `system_settings.clinical_copilot_enabled`:
//
//   GET    /api/admin/settings/clinical-copilot-enabled  → boolean
//   PUT    /api/admin/settings/clinical-copilot-enabled  → { enabled }
//
// The PUT path:
//   1. Validates the body is `{ enabled: boolean }`.
//   2. Snapshots the prior value for forensic completeness.
//   3. Persists via `systemSettingsRepository.updateSetting`.
//   4. Invalidates the 5-minute config cache so the very next
//      `getClinicalCopilotEnabled()` call reads the fresh value
//      (not the stale cached one).
//   5. Audit-logs `CLINICAL_COPILOT_TOGGLE_CHANGED` with prior + new.
//   6. Emits `'clinical-copilot:toggled'` to every connected socket
//      so doctors' open tabs flip in real time (input disables, banner
//      appears) without a refresh.
//
// Strict-TS: zero `any`, structural narrowing of `req.body`.

const CLINICAL_COPILOT_ENABLED_KEY = 'clinical_copilot_enabled' as const;

/**
 * Coerce the stored TEXT value to a boolean using the same defensive
 * semantics as `getClinicalCopilotEnabled()` in `config.util.ts`:
 * exactly `'true'` (lowercase) means enabled; anything else is
 * disabled. The read endpoint lives in `platform.controller.ts`
 * (public to every authenticated role); this helper is kept local
 * to the admin controller because only the write path needs to
 * compute the `priorEnabled` value for the audit log.
 */
const coerceCopilotEnabled = (raw: string | null): boolean => raw === 'true';

export const updateClinicalCopilotEnabled = async (req: Request, res: Response) => {
    try {
        const adminId = req.user?.id;
        if (!adminId) return sendError(res, 401, 'Unauthorized');

        const body: unknown = req.body;
        if (
            typeof body !== 'object'
            || body === null
            || !('enabled' in body)
            || typeof (body as { enabled: unknown }).enabled !== 'boolean'
        ) {
            return sendError(res, 400, 'Invalid body. Expected { enabled: boolean }.');
        }
        const next: boolean = (body as { enabled: boolean }).enabled;

        const priorRaw = await systemSettingsRepository.getSetting(CLINICAL_COPILOT_ENABLED_KEY);
        // No row → prior is `true` (institutional default), matching the
        // GET semantics. This makes the audit trail honest: the first
        // admin who flips OFF will see `priorEnabled: true`.
        const priorEnabled: boolean = priorRaw === null ? true : coerceCopilotEnabled(priorRaw);

        await systemSettingsRepository.updateSetting(
            CLINICAL_COPILOT_ENABLED_KEY,
            next ? 'true' : 'false',
        );

        // Drop the cached value so the next request's
        // `getClinicalCopilotEnabled()` reads the freshly-written row
        // instead of the stale 5-min cache.
        invalidateStringConfigCache(CLINICAL_COPILOT_ENABLED_KEY);

        await auditService.log({
            userId: adminId,
            actorRole: req.user?.role,
            action: 'CLINICAL_COPILOT_TOGGLE_CHANGED',
            entityType: 'SYSTEM_SETTINGS',
            entityId: CLINICAL_COPILOT_ENABLED_KEY,
            metadata: { priorEnabled, newEnabled: next },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });

        // Broadcast to every connected socket. Failure-tolerant — a
        // missing `socketIO` (server bootstrap, sockets disabled in
        // this runtime) logs at debug and continues; the DB write is
        // the source of truth, the broadcast is a UX accelerator.
        try {
            if (socketIO !== undefined) {
                socketIO.emit('clinical-copilot:toggled', { enabled: next });
            } else {
                logger.debug('[ClinicalCopilotToggle] socketIO not ready; skipping real-time broadcast');
            }
        } catch (broadcastError: unknown) {
            logger.warn('[ClinicalCopilotToggle] Broadcast emit failed; DB write succeeded', {
                error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError),
            });
        }

        return sendResponse(res, 200, true, 'Clinical copilot toggle updated', { enabled: next });
    } catch (error: unknown) {
        logger.error('Error updating clinical copilot toggle', {
            error: error instanceof Error ? error.message : String(error),
        });
        return sendError(res, 500, 'Error updating clinical copilot toggle');
    }
};

// Security and Observability (Admin only)
export const getSecurityEvents = async (req: Request, res: Response) => {
    const { limit = 50, offset = 0 } = req.query;
    try {
        const events = await securityRepository.getSecurityEvents(Number(limit), Number(offset));
        return sendResponse(res, 200, true, 'Security events fetched', events);
    } catch (error: unknown) {
        logger.error('Error fetching security events:', {
            error: error instanceof Error ? error.message : String(error),
            limit,
            offset
        });
        return sendError(res, 500, 'Error fetching security events');
    }
};

export const getActiveSessions = async (req: Request, res: Response) => {
    const { limit = 50, offset = 0 } = req.query;
    try {
        const sessions = await securityRepository.getActiveSessions(Number(limit), Number(offset));
        return sendResponse(res, 200, true, 'Active sessions fetched', sessions);
    } catch (error: unknown) {
        logger.error('Error fetching active sessions:', {
            error: error instanceof Error ? error.message : String(error),
            limit,
            offset
        });
        return sendError(res, 500, 'Error fetching active sessions');
    }
};

export const revokeSession = async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    try {
        if (typeof sessionId !== 'string') return sendError(res, 400, 'Invalid Session ID');
        const revoked = await securityRepository.revokeSession(sessionId);
        if (revoked !== null) {
            // Best-effort admin broadcast — the revoked session disappears
            // from every admin's Sessions page in real time. Failures
            // logged inside `emitToAdmins` and do not propagate to the
            // HTTP response.
            emitToAdmins({
                event: 'session:revoked',
                payload: {
                    id: revoked.id,
                    sessionId: revoked.sessionId,
                    userId: revoked.userId,
                    reason: 'admin_revoked',
                    revokedAt: revoked.revokedAt.toISOString(),
                },
            });
            return sendResponse(res, 200, true, 'Session revoked successfully');
        } else {
            return sendError(res, 404, 'Session not found or already inactive');
        }
    } catch (error: unknown) {
        logger.error('Error revoking session:', {
            error: error instanceof Error ? error.message : String(error),
            sessionId
        });
        return sendError(res, 500, 'Error revoking session');
    }
};

/**
 * GET /admin/monthly-signups
 *
 * Trailing-6-month aggregate of `users.created_at` for the admin
 * "Platform Growth" chart. The aggregation runs in the platform
 * clinic timezone so month boundaries match the admin's wall-clock
 * intuition; soft-deleted accounts are excluded. See
 * `analyticsRepository.getMonthlyUserSignups` for the SQL.
 */
export const getMonthlySignups = async (_req: Request, res: Response) => {
    try {
        const stats = await analyticsRepository.getMonthlyUserSignups();
        return sendResponse(res, 200, true, 'Monthly signups fetched', stats);
    } catch (error: unknown) {
        logger.error('Error fetching monthly signups:', {
            error: error instanceof Error ? error.message : String(error),
        });
        return sendError(res, 500, 'Error fetching monthly signups');
    }
};

export const getRevenueStats = async (_req: Request, res: Response) => {
    try {
        const stats = await analyticsRepository.getRevenueStats();
        return sendResponse(res, 200, true, 'Revenue stats fetched', stats);
    } catch (error: unknown) {
        logger.error('Error fetching revenue stats:', {
            error: error instanceof Error ? error.message : String(error)
        });
        return sendError(res, 500, 'Error fetching revenue stats');
    }
};

/**
 * 🛡️ HAEMI LIFE — System Health Endpoint (Phase 5)
 *
 * Returns a snapshot of process + database health for the admin dashboard
 * to render its "System Load" card live (5 s polling cadence — system
 * metrics are CPU-bound and don't benefit from socket pushes). Replaces
 * the previously-hardcoded "34%" placeholder.
 *
 * Field selection rationale:
 *   - `cpuPercent`: 1-minute system load average normalised to CPU count.
 *     Cheap to compute (`os.loadavg()` is a syscall on Linux/macOS) and
 *     correlates well with real CPU pressure. On Windows the kernel does
 *     not expose loadavg; `os.loadavg()` returns `[0, 0, 0]` there, in
 *     which case we fall back to a process-CPU-usage approximation.
 *   - `memoryPercent`: system-wide used memory as a percentage of total.
 *     Process RSS would understate the real load on a multi-tenant box.
 *   - `dbConnections`: live `pool.totalCount` / `idle` / `waiting` —
 *     surfaces connection-pool saturation BEFORE it becomes a 503.
 *   - `uptimeSeconds`: process uptime, useful for spotting unintended
 *     restarts when paired with the deployment timeline.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - All errors via `logger`. No `console.*`.
 */
export const getSystemHealth = async (_req: Request, res: Response) => {
    try {
        // CPU: normalised load average. `os.loadavg()` returns
        // `[1m, 5m, 15m]` averages; we use the 1-minute window for
        // responsiveness. Capped at 100% so a transient spike on a
        // single-core dev box doesn't render "300%".
        const cpuCount: number = Math.max(1, os.cpus().length);
        const loadAverage: ReadonlyArray<number> = os.loadavg();
        const oneMinuteLoad: number = loadAverage[0] ?? 0;
        const cpuPercentRaw: number = (oneMinuteLoad / cpuCount) * 100;
        const cpuPercent: number = Math.max(0, Math.min(100, Math.round(cpuPercentRaw)));

        // Memory: system-wide.
        const totalMem: number = os.totalmem();
        const freeMem: number = os.freemem();
        const usedMem: number = totalMem - freeMem;
        const memoryPercent: number = totalMem > 0
            ? Math.max(0, Math.min(100, Math.round((usedMem / totalMem) * 100)))
            : 0;

        // DB connection pool — types from `pg.Pool`.
        const dbConnections = {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
        };

        const uptimeSeconds: number = Math.floor(process.uptime());

        return sendResponse(res, 200, true, 'System health fetched', {
            cpuPercent,
            memoryPercent,
            dbConnections,
            uptimeSeconds,
            timestamp: new Date().toISOString(),
        });
    } catch (error: unknown) {
        logger.error('[Admin] Failed to fetch system health', {
            error: error instanceof Error ? error.message : String(error),
        });
        return sendError(res, 500, 'Failed to fetch system health');
    }
};
