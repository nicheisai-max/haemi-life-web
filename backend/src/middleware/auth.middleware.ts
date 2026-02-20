import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { auditService } from '../services/audit.service';

interface AuthRequest extends Request {
    user?: any;
}

/**
 * V9 FIX: JWT verification middleware.
 * - Missing token → 401 (Unauthorized)
 * - Invalid/expired token → 401 (Unauthorized)
 *
 * HTTP semantics:
 *   401 = "I don't know who you are" (unauthenticated)
 *   403 = "I know who you are, but you can't do this" (unauthorized/forbidden)
 */
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            statusCode: 401,
        });
    }

    jwt.verify(token, process.env.JWT_SECRET!, async (err: any, decoded: any) => {
        if (err) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired session. Please log in again.',
                statusCode: 401,
            });
        }

        try {
            // ULTRA-STRICT PRODUCTION LOCKDOWN: 
            // 1. Fetch user status, role, token_version, and inactivity data from DB
            const userResult = await pool.query(
                `SELECT name, initials, profile_image, status, role, token_version, last_activity, 
                (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_activity)) / 60) as minutes_since_activity 
                FROM users WHERE id = $1`,
                [decoded.id]
            );

            if (userResult.rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    error: 'User session invalid. Please log in again.',
                    statusCode: 401,
                });
            }

            const userData = userResult.rows[0];

            // 2. Token Version Validation (Revocation Check)
            if (decoded.token_version !== undefined && userData.token_version !== undefined) {
                if (decoded.token_version !== userData.token_version) {
                    return res.status(401).json({
                        success: false,
                        error: 'Session revoked. Please log in again.',
                        statusCode: 401,
                    });
                }
            }

            // 2. Status Validation (Standardized)
            if (userData.status !== 'ACTIVE') {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. Account restricted.',
                    statusCode: 403,
                });
            }

            // 3. Backend Inactivity Enforcement (60 Minute Threshold)
            const timeoutMinutes = 60;
            if (userData.minutes_since_activity !== null && userData.minutes_since_activity > timeoutMinutes) {
                return res.status(401).json({
                    success: false,
                    error: 'Session expired due to inactivity. Please log in again.',
                    statusCode: 401,
                });
            }

            // 4. Update activity heartbeat (Sliding Expiration)
            await pool.query('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1', [decoded.id]);

            // Update request user with latest data from DB
            req.user = {
                ...decoded,
                role: userData.role,
                name: userData.name,
                initials: userData.initials,
                profile_image: userData.profile_image,
                status: userData.status
            };
            next();
        } catch (dbError) {
            console.error('Auth middleware DB error:', dbError);
            return res.status(500).json({
                success: false,
                error: 'Internal server error during authentication.',
                statusCode: 500,
            });
        }
    });
};

/**
 * Relaxed Authentication Middleware (Discovery)
 * NEVER returns 401/403. Used for endpoints like /auth/me to check session status silently.
 */
export const relaxedAuthenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return next();

    jwt.verify(token, process.env.JWT_SECRET!, async (err: any, decoded: any) => {
        if (err) return next();

        try {
            const userResult = await pool.query(
                `SELECT name, initials, profile_image, status, role, token_version, last_activity, 
                (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_activity)) / 60) as minutes_since_activity 
                FROM users WHERE id = $1`,
                [decoded.id]
            );

            if (userResult.rows.length === 0) return next();

            const userData = userResult.rows[0];

            if (decoded.token_version !== undefined && userData.token_version !== undefined) {
                if (decoded.token_version !== userData.token_version) return next();
            }

            if (userData.status !== 'ACTIVE') return next();

            const timeoutMinutes = 60;
            if (userData.minutes_since_activity !== null && userData.minutes_since_activity > timeoutMinutes) {
                return next();
            }

            req.user = {
                ...decoded,
                role: userData.role,
                name: userData.name,
                initials: userData.initials,
                profile_image: userData.profile_image,
                status: userData.status
            };
            next();
        } catch (dbError) {
            next();
        }
    });
};

/**
 * requireRole: Single-role guard. Returns 403 (Forbidden) when role doesn't match.
 * V8 FIX: Does NOT expose the user's current role in the response body.
 */
export const requireRole = (allowedRole: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                statusCode: 401,
            });
        }

        if (req.user.role !== allowedRole) {
            // Log the access violation internally (full details for audit)
            await auditService.log({
                actor_id: req.user.id,
                actor_role: req.user.role,
                action_type: 'ACCESS_DENIED_RBAC',
                metadata: {
                    required_role: allowedRole,
                    attempted_path: req.originalUrl,
                    method: req.method,
                },
                ip_address: req.ip,
                user_agent: req.headers['user-agent'],
            });

            // V8: Never expose the user's current role or the required role in the response
            return res.status(403).json({
                success: false,
                error: 'Access denied. Insufficient permissions.',
                statusCode: 403,
            });
        }
        next();
    };
};

/**
 * authorizeRole: Multi-role guard. Returns 403 when none of the allowed roles match.
 * V8 FIX: Does NOT expose the user's current role in the response body.
 */
export const authorizeRole = (roles: string[]) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            await auditService.log({
                actor_id: req.user?.id,
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

            return res.status(403).json({
                success: false,
                error: 'Access denied. Insufficient permissions.',
                statusCode: 403,
            });
        }
        next();
    };
};
