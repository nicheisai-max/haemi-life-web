import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { auditService, SYSTEM_ANONYMOUS_ID } from '../services/audit.service';
import { JWTPayload } from '../types/express';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';
import { getSessionTimeoutMinutes } from '../utils/config.util';
import { UserRole, UserStatus } from '../types/db.types';

interface AuthUserRow {
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

interface AuthSessionRow {
    revoked: boolean;
    access_token_jti: string | null;
    previous_access_token_jti: string | null;
    jti_rotated_at: Date | string | null;
    ip_address: string | null;
    user_agent: string | null;
    expires_at: Date | null;
    last_activity: Date;
}

/**
 * Standard Authentication Middleware
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return sendError(res, 401, 'Authentication required');
    }

    jwt.verify(token, process.env.JWT_SECRET as string, async (err: jwt.VerifyErrors | null, decoded: unknown) => {
        if (err) {
            return sendError(res, 401, 'Invalid or expired session. Please log in again.');
        }

        if (!decoded || typeof decoded !== 'object') {
            return sendError(res, 401, 'Invalid session payload.');
        }

        const payload = decoded as JWTPayload;

        try {
            const userResult = await pool.query<AuthUserRow>(
                `SELECT name, initials, profile_image, profile_image_mime, status, role, token_version, last_activity, 
                (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_activity)) / 60) as minutes_since_activity 
                FROM users WHERE id = $1`,
                [payload.id]
            );

            if (userResult.rows.length === 0) {
                return sendError(res, 401, 'User session invalid. Please log in again.');
            }

            const userData = userResult.rows[0];

            // 1. Token Version Check (Emergency Revocation)
            if (payload.tokenVersion !== undefined && userData.token_version !== undefined) {
                if (payload.tokenVersion !== userData.token_version) {
                    return sendError(res, 401, 'Session revoked. Please log in again.');
                }
            }

            if (userData.status !== 'ACTIVE') {
                return sendError(res, 403, 'Access denied. Account restricted.');
            }

            // 2. Detailed Session & Fingerprint Validation
            if (payload.sessionId) {
                const sessionResult = await pool.query<AuthSessionRow>(
                    'SELECT revoked, access_token_jti, previous_access_token_jti, jti_rotated_at, ip_address, user_agent, expires_at, last_activity FROM user_sessions WHERE session_id = $1',
                    [payload.sessionId]
                );

                if (sessionResult.rows.length === 0 || sessionResult.rows[0].revoked) {
                    return sendError(res, 401, 'Session revoked or invalid. Please log in again.');
                }

                const sessionData = sessionResult.rows[0];
                const now = new Date();

                // 4. Sliding Window Expiry Check
                if (sessionData.expires_at && new Date(sessionData.expires_at).getTime() < now.getTime()) {
                    return sendError(res, 401, 'Session expired. Please log in again.');
                }

                // 5. Access Token JTI Enforcement (Multi-tab synchronization)
                const currentAccessJti = sessionData.access_token_jti;
                const previousAccessJti = sessionData.previous_access_token_jti;
                const rotatedAt = sessionData.jti_rotated_at ? new Date(sessionData.jti_rotated_at).getTime() : 0;
                const nowMs = Date.now();
                const GRACE_PERIOD_MS = 60 * 1000; // 60s grace for atomic tab sync

                const isCurrentJti = currentAccessJti && payload.jti === currentAccessJti;
                const isGracefulJti = previousAccessJti && payload.jti === previousAccessJti && (nowMs - rotatedAt) < GRACE_PERIOD_MS;

                if (!isCurrentJti && !isGracefulJti) {
                    logger.warn('[Security] Access token JTI violation (multi-tab collision detected)', {
                        userId: payload.id,
                        jti: payload.jti,
                        currentJti: currentAccessJti,
                        previousJti: previousAccessJti,
                        timeSinceRotation: rotatedAt ? (nowMs - rotatedAt) / 1000 : 'N/A'
                    });
                    return sendError(res, 401, 'Session token displaced. Synchronizing tabs required.');
                }

                // Fingerprint Validation
                const currentUserAgent = req.headers['user-agent'];

                if (sessionData.user_agent !== currentUserAgent) {
                    logger.warn('Session fingerprint mismatch (User Agent)', {
                        userId: payload.id,
                        expected: sessionData.user_agent,
                        received: currentUserAgent
                    });
                    return sendError(res, 401, 'Security fingerprint mismatch. Session invalidated.');
                }

                // IP binding check
                if (sessionData.ip_address !== req.ip && process.env.STRICT_IP_CHECK === 'true') {
                    return sendError(res, 401, 'Security fingerprint mismatch. Session invalidated.');
                }

                // Heartbeat: Update session last_activity and sliding expires_at
                const lastActivityTime = sessionData.last_activity ? new Date(sessionData.last_activity).getTime() : 0;
                
                if (nowMs - lastActivityTime > 60000) { // 1 minute throttle
                    const timeoutMinutes = await getSessionTimeoutMinutes();
                    const newExpiresAt = new Date(nowMs + timeoutMinutes * 60 * 1000);

                    await pool.query(
                        'UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP, expires_at = $1 WHERE session_id = $2',
                        [newExpiresAt, payload.sessionId]
                    );
                    
                    await pool.query('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1', [payload.id]);
                }
            }

            req.user = {
                ...payload,
                role: userData.role,
                name: userData.name,
                initials: userData.initials,
                profileImage: userData.profile_image,
                profileImageMime: userData.profile_image_mime,
                status: userData.status
            };
            return next();
        } catch (error: unknown) {
            logger.error('Session verification failed', { 
                error: error instanceof Error ? error.message : String(error),
                userId: payload.id,
                sessionId: payload.sessionId 
            });
            return sendError(res, 500, 'Server error during session verification');
        }
    });
};

export const protect = authenticateToken;

/**
 * Relaxed Authentication Middleware (Discovery)
 */
export const relaxedAuthenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return next();

    jwt.verify(token, process.env.JWT_SECRET as string, async (err: jwt.VerifyErrors | null, decoded: unknown) => {
        if (err || !decoded || typeof decoded !== 'object') return next();

        const payload = decoded as JWTPayload;

        try {
            const userResult = await pool.query<AuthUserRow>(
                `SELECT name, initials, profile_image, profile_image_mime, status, role, token_version, last_activity, 
                (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_activity)) / 60) as minutes_since_activity 
                FROM users WHERE id = $1`,
                [payload.id]
            );

            if (userResult.rows.length === 0) return next();

            const userData = userResult.rows[0];

            if (payload.tokenVersion !== undefined && userData.token_version !== undefined) {
                if (payload.tokenVersion !== userData.token_version) return next();
            }

            if (userData.status !== 'ACTIVE') return next();

            const timeoutMinutes = await getSessionTimeoutMinutes();
            if (userData.minutes_since_activity !== null && userData.minutes_since_activity > timeoutMinutes) {
                return next();
            }

            // Relaxed JTI check
            if (payload.jti && payload.sessionId) {
                const sessionResult = await pool.query<AuthSessionRow>(
                    'SELECT revoked, access_token_jti FROM user_sessions WHERE session_id = $1',
                    [payload.sessionId]
                );
                if (sessionResult.rows.length === 0 || sessionResult.rows[0].revoked) return next();
                if (sessionResult.rows[0].access_token_jti !== payload.jti) return next();
            }

            req.user = {
                ...payload,
                role: userData.role,
                name: userData.name,
                initials: userData.initials,
                profileImage: userData.profile_image,
                profileImageMime: userData.profile_image_mime,
                status: userData.status
            };
            return next();
        } catch (error: unknown) {
            logger.warn('Unexpected error in relaxed authentication', { 
                error: error instanceof Error ? error.message : String(error) 
            });
            return next();
        }
    });
};

/**
 * Single-role guard
 */
export const requireRole = (allowedRole: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user || req.user.role !== allowedRole) {
            await auditService.log({
                userId: req.user?.id || SYSTEM_ANONYMOUS_ID,
                actorRole: req.user?.role,
                actionType: 'ACCESS_DENIED_RBAC',
                metadata: {
                    required_role: allowedRole,
                    attempted_path: req.originalUrl,
                    method: req.method,
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });

            return sendError(res, 403, 'Access denied. Insufficient permissions.');
        }
        next();
    };
};

/**
 * Multi-role guard
 */
export const authorizeRole = (roles: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            await auditService.log({
                userId: req.user?.id || SYSTEM_ANONYMOUS_ID,
                actorRole: req.user?.role,
                actionType: 'ACCESS_DENIED_RBAC_MULTI',
                metadata: {
                    required_roles: roles,
                    attempted_path: req.originalUrl,
                    method: req.method,
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });

            return sendError(res, 403, 'Access denied. Insufficient permissions.');
        }
        next();
    };
};

export function restrictTo(...roles: string[]) {
    return authorizeRole(roles);
}
