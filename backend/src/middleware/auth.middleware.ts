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

    jwt.verify(token, process.env.JWT_SECRET!, (err: any, decoded: any) => {
        if (err) {
            // Both expired and invalid tokens → 401, not 403
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired session. Please log in again.',
                statusCode: 401,
            });
        }
        req.user = decoded;
        next();
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
