import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { auditService } from '../services/audit.service';
import { JWTPayload } from '../types/express';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';

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

            if (payload.token_version !== undefined && userData.token_version !== undefined) {
                if (payload.token_version !== userData.token_version) {
                    return sendError(res, 401, 'Session revoked. Please log in again.');
                }
            }

            if (userData.status !== 'ACTIVE') {
                return sendError(res, 403, 'Access denied. Account restricted.');
            }

            const timeoutMinutes = 60;
            if (userData.minutes_since_activity !== null && userData.minutes_since_activity > timeoutMinutes) {
                return sendError(res, 401, 'Session expired due to inactivity. Please log in again.');
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
                actor_id: req.user?.id,
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

            return sendError(res, 403, 'Access denied. Insufficient permissions.');
        }
        next();
    };
};

/**
 * Alias for authorizeRole to support 'restrictTo' pattern
 */
export const restrictTo = (...roles: string[]) => authorizeRole(roles);
