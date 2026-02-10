import { Request, Response, NextFunction } from 'express';

export const requireRole = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user; // Set by auth middleware

        if (!user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({
                message: 'Access denied. Insufficient permissions.',
                required: allowedRoles,
                current: user.role
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
