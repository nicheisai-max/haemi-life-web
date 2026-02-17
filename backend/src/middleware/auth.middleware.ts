import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthRequest extends Request {
    user?: any;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET as string, (err: any, user: any) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

import { auditService } from '../services/audit.service';

export const requireRole = (allowedRole: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        if (req.user.role !== allowedRole) {
            // CRITICAL SECURITY LOGGING
            await auditService.log({
                actor_id: req.user.id,
                actor_role: req.user.role,
                action_type: 'ACCESS_DENIED_RBAC',
                metadata: {
                    required_role: allowedRole,
                    attempted_path: req.originalUrl,
                    method: req.method
                },
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            });

            return res.status(403).json({
                message: `Access denied. ${allowedRole.toUpperCase()} privilege required.`
            });
        }
        next();
    };
};

export const authorizeRole = (roles: string[]) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            await auditService.log({
                actor_id: req.user?.id,
                actor_role: req.user?.role,
                action_type: 'ACCESS_DENIED_RBAC_MULTI',
                metadata: {
                    required_roles: roles,
                    attempted_path: req.originalUrl
                },
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            });
            return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
        }
        next();
    };
};
