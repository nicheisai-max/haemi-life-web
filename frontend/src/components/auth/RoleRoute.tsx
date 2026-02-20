import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { MedicalLoader } from '../ui/MedicalLoader';

interface RoleRouteProps {
    children: React.ReactElement;
    allowedRoles: string[];
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ children, allowedRoles }) => {
    const { user, isLoading, isAuthenticated, authStatus } = useAuth();
    const location = useLocation();

    // During initial app-load verification, show a loader.
    // Never redirect during this phase.
    if (isLoading) {
        return <MedicalLoader fullPage message="Verifying clinical identity..." />;
    }

    // V12 FIX: Mandatory "Authenticated" check before RBAC processing.
    if (!isAuthenticated || authStatus !== 'authenticated' || !user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!allowedRoles.includes(user.role)) {
        console.warn(`[RoleRoute] Access denied: role '${user.role}' cannot access route requiring '${allowedRoles.join(', ')}'.`);

        const dashboardMap: Record<string, string> = {
            'patient': '/dashboard',
            'doctor': '/dashboard',
            'pharmacist': '/dashboard',
            'admin': '/admin',
        };

        return <Navigate to={dashboardMap[user.role] ?? '/login'} replace />;
    }

    return children;
};

