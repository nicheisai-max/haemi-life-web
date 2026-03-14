import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { auditService } from '../services/audit.service';
import { JWTPayload } from '../types/express';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';
import { getSessionTimeoutMinutes } from '../utils/config.util';

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
            const userResult = await pool.query(
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
            if (payload.token_version !== undefined && userData.token_version !== undefined) {
                if (payload.token_version !== userData.token_version) {
                    return sendError(res, 401, 'Session revoked. Please log in again.');
                }
            }

            if (userData.status !== 'ACTIVE') {
                return sendError(res, 403, 'Access denied. Account restricted.');
            }

            // (Legacy user-level inactivity check removed in favor of per-session sliding window)

            // 2. Phase 9: Detailed Session & Fingerprint Validation
            if (payload.session_id) {
                const sessionResult = await pool.query(
                    'SELECT revoked, access_token_jti, previous_access_token_jti, jti_rotated_at, ip_address, user_agent, expires_at FROM user_sessions WHERE session_id = $1',
                    [payload.session_id]
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

                // 5. Access Token JTI Enforcement (Dispacement Tolerance)
                // Check if this token's JTI matches the current session or the recently rotated one (grace window)
                const currentAccessJti = sessionData.access_token_jti;
                const previousAccessJti = sessionData.previous_access_token_jti;
                const rotatedAt = sessionData.jti_rotated_at ? new Date(sessionData.jti_rotated_at).getTime() : 0;
                const nowMs = Date.now();
                const GRACE_PERIOD_MS = 60 * 1000;

                const isCurrentJti = currentAccessJti && payload.jti === currentAccessJti;
                const isGracefulJti = previousAccessJti && payload.jti === previousAccessJti && (nowMs - rotatedAt) < GRACE_PERIOD_MS;

                if (!isCurrentJti && !isGracefulJti) {
                    logger.warn('Access token JTI violation (displaced)', {
                        userId: payload.id,
                        jti: payload.jti,
                        currentJti: currentAccessJti,
                        previousJti: previousAccessJti,
                        rotatedAt: sessionData.jti_rotated_at
                    });
                    return sendError(res, 401, 'Session token displaced. Please log in again.');
                }

                // Fingerprint Validation (Session Hijacking Protection)
                // Note: We allow minor IP changes in dynamic environments, but log suspicious ones
                const currentIp = req.ip;
                const currentUserAgent = req.headers['user-agent'];

                if (sessionData.user_agent !== currentUserAgent) {
                    logger.warn('Session fingerprint mismatch (User Agent)', {
                        userId: payload.id,
                        expected: sessionData.user_agent,
                        received: currentUserAgent
                    });
                    // For local development, we might be lenient, but for P0 hardening we reject
                    return sendError(res, 401, 'Security fingerprint mismatch. Session invalidated.');
                }

                // IP binding check (log only or reject if process.env.STRICT_IP_CHECK is true)
                if (sessionData.ip_address !== currentIp && process.env.STRICT_IP_CHECK === 'true') {
                    return sendError(res, 401, 'Security fingerprint mismatch. Session invalidated.');
                }

                // Heartbeat: Update session last_activity and sliding expires_at
                const timeoutMinutes = await getSessionTimeoutMinutes();
                const newExpiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

                await pool.query(
                    'UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP, expires_at = $1 WHERE session_id = $2',
                    [newExpiresAt, payload.session_id]
                );
            }

            await pool.query('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1', [payload.id]);

            req.user = {
                ...payload,
                role: userData.role,
                name: userData.name,
                initials: userData.initials,
                profile_image: userData.profile_image,
                profile_image_mime: userData.profile_image_mime,
                status: userData.status
            };
            next();
        } catch (error: unknown) {
            logger.error('Session verification failed', error);
            return sendError(res, 500, 'Server error');
        }
    });
};

/**
 * Alias for authenticateToken to support both legacy and new names
 */
export const protect = authenticateToken;

/**
 * Relaxed Authentication Middleware (Discovery)
 */
export const relaxedAuthenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return next();

    jwt.verify(token, process.env.JWT_SECRET as string, async (err: jwt.VerifyErrors | null, decoded: unknown) => {
        if (err) return next();

        if (!decoded || typeof decoded !== 'object') return next();

        const payload = decoded as JWTPayload;

        try {
            const userResult = await pool.query(
                `SELECT name, initials, profile_image, profile_image_mime, status, role, token_version, last_activity, 
                (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_activity)) / 60) as minutes_since_activity 
                FROM users WHERE id = $1`,
                [payload.id]
            );

            if (userResult.rows.length === 0) return next();

            const userData = userResult.rows[0];

            if (payload.token_version !== undefined && userData.token_version !== undefined) {
                if (payload.token_version !== userData.token_version) return next();
            }

            if (userData.status !== 'ACTIVE') return next();

            const timeoutMinutes = 60;
            if (userData.minutes_since_activity !== null && userData.minutes_since_activity > timeoutMinutes) {
                return next();
            }

            // Relaxed JTI check
            if (payload.jti && payload.session_id) {
                const sessionResult = await pool.query(
                    'SELECT revoked, access_token_jti FROM user_sessions WHERE session_id = $1',
                    [payload.session_id]
                );
                if (sessionResult.rows.length === 0 || sessionResult.rows[0].revoked) return next();
                if (sessionResult.rows[0].access_token_jti !== payload.jti) return next();
            }

            req.user = {
                ...payload,
                role: userData.role,
                name: userData.name,
                initials: userData.initials,
                profile_image: userData.profile_image,
                profile_image_mime: userData.profile_image_mime,
                status: userData.status
            };
            next();
        } catch (error: unknown) {
            logger.error('Unexpected error in relaxed authentication', error);
            next();
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
                user_id: req.user?.id,
                actor_role: req.user?.role,
                action_type: 'ACCESS_DENIED_RBAC',
                metadata: {
                    required_role: allowedRole,
                    attempted_path: req.originalUrl,
                    method: req.method,
                },
                ip_address: req.ip,
                user_agent: req.headers['user-agent'],
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
                user_id: req.user?.id,
                actor_role: req.user?.role,
                action_type: 'ACCESS_DENIED_RBAC_MULTI',
                metadata: {
                    required_roles: roles,
                    attempted_path: req.originalUrl,
                    method: req.method,
                },
                ip_address: req.ip,
                user_agent: req.headers['user-agent'],
            });

            return sendError(res, 403, 'Access denied. Insufficient permissions.');
        }
        next();
    };
};

/**
 * Alias for authorizeRole to support 'restrictTo' pattern
 */
export const restrictTo = (...roles: string[]) => authorizeRole(roles);
