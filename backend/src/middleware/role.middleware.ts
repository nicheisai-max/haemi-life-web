import { Request, Response, NextFunction } from 'express';

/**
 * Role-Based Access Control (RBAC) Middleware.
 * Standardized to authorize(...roles) and provides pre-configured guards.
 */

export const authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                statusCode: 401,
            });
        }

        if (!roles.includes(user.role)) {
            // Log internally but never expose to client
            console.warn(`[RBAC] Access denied: user ${user.id} (role: ${user.role}) → ${req.method} ${req.originalUrl}`);
            return res.status(403).json({
                success: false,
                error: 'Access denied. Insufficient permissions.',
                statusCode: 403,
            });
        }

        next();
    };
};

// Backwards compatibility and convenience guards
export const requireRole = (roles: string[]) => authorize(...roles);

export const requireDoctor = authorize('doctor');
export const requirePatient = authorize('patient');
export const requireAdmin = authorize('admin');
export const requirePharmacist = authorize('pharmacist');
export const requireDoctorOrAdmin = authorize('doctor', 'admin');
export const requirePatientOrDoctor = authorize('patient', 'doctor');
