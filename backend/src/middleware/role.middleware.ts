import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';
import { UserRole } from '../types/db.types';

/**
 * Role-Based Access Control (RBAC) Middleware.
 * Standardized to authorize(...roles) and provides pre-configured guards.
 */

export const authorize = (...roles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;

        if (!user) {
            return sendError(res, 401, 'Authentication required');
        }

        if (!roles.includes(user.role as UserRole)) {
            // Log internally but never expose to client
            logger.warn(`[RBAC] Access denied: user ${user.id} (role: ${user.role}) → ${req.method} ${req.originalUrl}`, {
                userId: user.id,
                role: user.role,
                attemptedPath: req.originalUrl
            });
            return sendError(res, 403, 'Access denied. Insufficient permissions.');
        }

        return next();
    };
};

// Backwards compatibility and convenience guards
export const requireRole = (roles: UserRole[]) => authorize(...roles);

export const requireDoctor = authorize('doctor');
export const requirePatient = authorize('patient');
export const requireAdmin = authorize('admin');
export const requirePharmacist = authorize('pharmacist');
export const requireDoctorOrAdmin = authorize('doctor', 'admin');
export const requirePatientOrDoctor = authorize('patient', 'doctor');
