import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { MedicalLoader } from '../ui/MedicalLoader';
import { useIsPresent } from 'framer-motion';

interface RoleRouteProps {
    children: React.ReactElement;
    allowedRoles: string[];
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ children, allowedRoles }) => {
    const { user, isLoading, isAuthenticated, authStatus } = useAuth();
    const location = useLocation();
    const isPresent = useIsPresent();

    if (isLoading) {
        return <MedicalLoader fullPage message="Verifying clinical identity..." />;
    }

    if (!isAuthenticated || authStatus !== 'authenticated' || !user) {
        if (!isPresent) return null;
        return <Navigate to="/login" state={{ from: location?.pathname }} replace />;
    }

    if (!allowedRoles.includes(user.role)) {
        if (!isPresent) return null;
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

