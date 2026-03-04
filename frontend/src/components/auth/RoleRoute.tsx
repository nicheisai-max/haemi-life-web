import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MedicalLoader } from '../ui/MedicalLoader';

interface RoleRouteProps {
    children: React.ReactElement;
    allowedRoles: string[];
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ children, allowedRoles }) => {
    const { user, isLoading, isAuthenticated, authStatus } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <MedicalLoader fullPage message="Verifying clinical identity..." />;
    }

    if (!isAuthenticated || authStatus !== 'authenticated' || !user) {
        return <Navigate to="/login" state={{ from: location?.pathname }} replace />;
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

