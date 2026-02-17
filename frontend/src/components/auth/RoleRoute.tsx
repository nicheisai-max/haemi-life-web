import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader } from '../ui/Loader';

interface RoleRouteProps {
    children: React.ReactElement;
    allowedRoles: string[];
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ children, allowedRoles }) => {
    const { user, isLoading, isAuthenticated } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return <Loader variant="fullscreen" />;
    }

    if (!isAuthenticated || !user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!allowedRoles.includes(user.role)) {
        // Strict Role Mismatch Handling
        console.warn(`Access Denied: User role '${user.role}' attempted to access protected route requiring '${allowedRoles.join(', ')}'.`);

        // Redirect to their own dashboard if possible, or home
        // This prevents infinite loops if they try to access a role route they don't have
        const dashboardMap: Record<string, string> = {
            'patient': '/dashboard',
            'doctor': '/dashboard', // All dashboards currently live under /dashboard but with different content
            'pharmacist': '/dashboard',
            'admin': '/admin/dashboard'
        };

        const target = dashboardMap[user.role] || '/login';

        // Prevent redirect loop if the user is already at their target but somehow it's still restricted??
        // (Unlikely with correct routing, but safe to check)

        return <Navigate to={target} replace />;
    }

    return children;
};
