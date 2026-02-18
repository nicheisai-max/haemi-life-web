import { Request, Response, NextFunction } from 'express';

/**
 * V8 FIX: Role middleware.
 * The 403 response no longer exposes the user's current role or the required roles.
 * Exposing role information in error responses is an information disclosure vulnerability
 * that helps attackers enumerate valid roles and craft targeted privilege escalation attacks.
 */
export const requireRole = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                statusCode: 401,
            });
        }

        if (!allowedRoles.includes(user.role)) {
            // Log internally (full details) but never expose to client
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

export const requireDoctor = requireRole(['doctor']);
export const requirePatient = requireRole(['patient']);
export const requireAdmin = requireRole(['admin']);
export const requirePharmacist = requireRole(['pharmacist']);
export const requireDoctorOrAdmin = requireRole(['doctor', 'admin']);
export const requirePatientOrDoctor = requireRole(['patient', 'doctor']);
