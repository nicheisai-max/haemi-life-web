import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { auditService, SYSTEM_ANONYMOUS_ID } from '../services/audit.service';
import { JWTPayload as GlobalJWTPayload } from '../types/express';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';
import { getSessionTimeoutMinutes } from '../utils/config.util';
import { UserRole, UserStatus } from '../types/db.types';

/**
 * PHASE 7.3.2 — ZERO DRIFT TYPES
 */
type JwtPayloadStrict = {
    id: string;
    sessionId: string;
    tokenVersion: number;
    email: string;
    role: 'patient' | 'doctor' | 'pharmacist' | 'admin';
    jti: string;
    exp?: number;
    iat?: number;
};

/**
 * Local Bridge Interface
 * PHASE 7.3.2 — ZERO DRIFT: Standardizing on 'id' to match JWT and DB entities.
 */
interface LocalJWTPayload extends GlobalJWTPayload {
    id: string; // Unified with JWT 'id'
}

/**
 * Local Request Interface for Middleware
 * This allows direct assignment to req.user without casting.
 */
interface AuthenticatedRequest extends Request {
    user?: LocalJWTPayload;
}

interface AuthUserRow {
    id: string;
    email: string;
    name: string;
    initials: string;
    profile_image: string | null;
    profile_image_mime: string | null;
    status: UserStatus;
    role: UserRole;
    token_version: number;
    last_activity: Date;
    minutes_since_activity: number | null;
}


/**
 * FIX 2 — TYPE GUARD
 */
function isLocalJWTPayload(user: unknown): user is LocalJWTPayload {
    return (
        typeof user === 'object' &&
        user !== null &&
        'id' in user &&
        'role' in user &&
        'email' in user
    );
}

/**
 * Runtime Validation Helper for JWT Payload
 */
const validateJwtPayload = (decoded: unknown): decoded is JwtPayloadStrict => {
    return (
        typeof decoded === 'object' &&
        decoded !== null &&
        'id' in decoded &&
        'sessionId' in decoded &&
        'tokenVersion' in decoded &&
        'email' in decoded &&
        'role' in decoded &&
        'jti' in decoded
    );
};

/**
 * Standard Authentication Middleware (Institutional Grade)
 */
export const authenticateToken = async (inputReq: Request, res: Response, next: NextFunction) => {
    const req = inputReq as AuthenticatedRequest;
    const authHeader = req.headers['authorization'];

    // 🛡️ ENTERPRISE DOWNLOAD GATE: Accept ?token= query param as fallback.
    // When the browser navigates directly to a file URL (e.g., "Save to Device"),
    // no Authorization header is sent. The ?token= query param allows direct navigation
    // while preserving the full verification chain below (DB check, session, role).
    // Security: Same JWT_SECRET, same DB checks — no privileges bypassed.
    const token = (authHeader && authHeader.split(' ')[1])
        || (typeof req.query.token === 'string' ? req.query.token : undefined);

    if (!token) {
        logger.info('[Auth.Middleware] Anonymous access attempt blocked.');
        return sendError(res, 401, 'Authentication required');
    }

    jwt.verify(token, process.env.JWT_SECRET as string, async (err: jwt.VerifyErrors | null, decoded: unknown) => {
        if (err || !validateJwtPayload(decoded)) {
            logger.warn('[Auth.Middleware] Invalid or expired JWT intercepted.', { error: err?.message });
            return sendError(res, 401, 'Invalid or expired session.');
        }

        const payload: JwtPayloadStrict = decoded;

        try {
            // Institutional Guard: Verify user exists and status is ACTIVE
            const userResult = await pool.query<AuthUserRow>(
                'SELECT id, email, name, initials, profile_image, profile_image_mime, status, role, token_version, last_activity FROM users WHERE id = $1',
                [payload.id]
            );

            if (userResult.rows.length === 0) {
                logger.warn('[Auth.Middleware] Ghost user session attempt', { userId: payload.id });
                return sendError(res, 401, 'User session invalid.');
            }

            const userData = userResult.rows[0];

            // Versioning Guard: Detect and reject revoked token versions
            if (payload.tokenVersion !== userData.token_version) {
                logger.warn('[Auth.Middleware] Token version mismatch (Revoked)', { userId: payload.id });
                return sendError(res, 401, 'Session revoked.');
            }

            if (userData.status !== 'ACTIVE') {
                logger.warn('[Auth.Middleware] Restricted account access attempt', { userId: payload.id, status: userData.status });
                return sendError(res, 403, 'Account restricted.');
            }

            // Session Silo Guard: Verify physical session status in database
            const sessionResult = await pool.query<{ revoked: boolean, last_activity: Date }>(
                'SELECT revoked, last_activity FROM user_sessions WHERE session_id = $1',
                [payload.sessionId]
            );

            if (sessionResult.rows.length === 0 || sessionResult.rows[0].revoked) {
                logger.warn('[Auth.Middleware] Explicitly revoked session attempt', { sessionId: payload.sessionId });
                return sendError(res, 401, 'Session invalid.');
            }

            // High-Performance Activity Tracking (Batch-optimized)
            const sessionData = sessionResult.rows[0];
            const nowMs = Date.now();
            const last_activity_time = sessionData.last_activity ? new Date(sessionData.last_activity).getTime() : 0;

            if (nowMs - last_activity_time > 60000 && process.env.NODE_ENV !== 'test') {
                const timeoutMinutes = await getSessionTimeoutMinutes();
                const newExpiresAt = new Date(nowMs + timeoutMinutes * 60 * 1000);

                // Nuclear Persistence: Update both user and session markers
                Promise.all([
                    pool.query('UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP, expires_at = $1 WHERE session_id = $2', [newExpiresAt, payload.sessionId]),
                    pool.query('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1', [payload.id])
                ]).catch(error => {
                    logger.error('[Auth.Middleware] Background pulse update failed', {
                        error: error instanceof Error ? error.message : String(error)
                    });
                });
            }

            const finalUserPayload: LocalJWTPayload = {
                id: userData.id,
                email: userData.email,
                role: userData.role,
                name: userData.name,
                initials: userData.initials,
                tokenVersion: payload.tokenVersion,
                jti: payload.jti,
                sessionId: payload.sessionId,
                status: userData.status,
                profileImage: userData.profile_image,
                profileImageMime: userData.profile_image_mime
            };

            req.user = finalUserPayload;
            return next();
        } catch (error: unknown) {
            logger.error('[Auth.Middleware.authenticateToken] Systemic failure', {
                userId: payload.id,
                error: error instanceof Error ? error.message : String(error)
            });
            return sendError(res, 500, 'Server error');
        }
    });
};

export const protect = authenticateToken;

/**
 * Standard RBAC Guard (Role-Based Access Control)
 */
export const authorizeRole = (roles: UserRole[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;
        if (!isLocalJWTPayload(user) || !roles.includes(user.role as UserRole)) {
            await auditService.log({
                userId: isLocalJWTPayload(user) ? user.id : SYSTEM_ANONYMOUS_ID,
                actorRole: isLocalJWTPayload(user) ? user.role : undefined,
                action: 'ACCESS_DENIED_RBAC',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });

            logger.warn('[Auth.Middleware] RBAC Access Rejected', {
                userId: user?.id,
                required: roles,
                actual: user?.role
            });

            return sendError(res, 403, 'Access denied.');
        }
        next();
    };
};

/**
 * @deprecated Use authorizeRole directly for single roles if needed, or this wrapper.
 */
export const requireRole = (allowedRole: UserRole) => authorizeRole([allowedRole]);

/**
 * @deprecated Use authorizeRole directly.
 */
export const restrictTo = (...roles: UserRole[]) => authorizeRole(roles);

/**
 * Graceful Decryption for Public/Private Hybrid Routes
 */
export const relaxedAuthenticateToken = (inputReq: Request, res: Response, next: NextFunction) => {
    const req = inputReq as AuthenticatedRequest;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return next();

    jwt.verify(token, process.env.JWT_SECRET as string, async (err: jwt.VerifyErrors | null, decoded: unknown) => {
        if (err || !validateJwtPayload(decoded)) return next();

        const payload: JwtPayloadStrict = decoded;

        try {
            const userResult = await pool.query<AuthUserRow>('SELECT status, role, token_version FROM users WHERE id = $1', [payload.id]);
            if (userResult.rows.length === 0) return next();

            const userData = userResult.rows[0];
            if (payload.tokenVersion !== userData.token_version || userData.status !== 'ACTIVE') return next();

            const finalUserPayload: LocalJWTPayload = {
                id: payload.id,
                email: payload.email,
                role: payload.role as UserRole,
                name: '',
                tokenVersion: payload.tokenVersion,
                jti: payload.jti,
                sessionId: payload.sessionId,
                status: userData.status
            };

            req.user = finalUserPayload;
            return next();
        } catch (error: unknown) {
            logger.error('[Auth.Middleware.relaxedAuthenticateToken] Silent capture failure', {
                error: error instanceof Error ? error.message : String(error)
            });
            return next();
        }
    });
};
