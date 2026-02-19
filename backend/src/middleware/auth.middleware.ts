import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthRequest extends Request {
    user?: any;
}

/**
 * V9 FIX: JWT verification middleware.
 * - Missing token → 401 (Unauthorized)
 * - Invalid/expired token → 401 (Unauthorized) — was incorrectly returning 403
 *
 * HTTP semantics:
 *   401 = "I don't know who you are" (unauthenticated)
 *   403 = "I know who you are, but you can't do this" (unauthorized/forbidden)
 * A bad JWT means we don't know who the user is → 401 is correct.
 * 403 is reserved for role/permission failures (see requireRole below).
 */
import { pool } from '../config/db';

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
            // Enterprise Mode: Check if user is active in DB
            const userResult = await pool.query('SELECT is_active, role FROM users WHERE id = $1', [decoded.id]);

            if (userResult.rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    error: 'User not found.',
                    statusCode: 401,
                });
            }

            if (!userResult.rows[0].is_active) {
                return res.status(403).json({
                    success: false,
                    error: 'Your account has been deactivated. Please contact administrator.',
                    statusCode: 403,
                });
            }

            // Update request user with latest role from DB just in case
            req.user = { ...decoded, role: userResult.rows[0].role };
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

import { auditService } from '../services/audit.service';

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
