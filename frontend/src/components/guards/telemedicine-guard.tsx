import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { PATHS } from '@/routes/paths';

/**
 * 🛡️ TELEMEDICINE INSTITUTIONAL GUARD
 * handles atomic redirection for telemedicine consent requirements.
 * This guard ensures that users without consent are diverted to the consent portal,
 * and users with consent are diverted back to the clinical dashboard.
 */
export const TelemedicineGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isAuthenticated, isLoading, isRefreshing } = useAuth();
    const location = useLocation();

    // 🧬 Phase 1: Authentication Guard
    // If we're still loading, refreshing, or not authenticated, defer to parent ProtectedRoute
    if (isLoading || isRefreshing || !isAuthenticated || !user) {
        return <>{children}</>;
    }

    const isOnConsentPage = location.pathname === PATHS.CONSENT;
    const hasConsent = !!user.hasConsent;

    // 🧬 Phase 2: Atomic Redirection Logic
    // Case A: User is on Telemedicine but LACKS consent -> divert to Consent Portal
    if (!isOnConsentPage && !hasConsent) {
        return <Navigate to={PATHS.CONSENT} replace />;
    }

    // Case B: User is on Consent Portal but ALREADY HAS consent -> divert back to Telemedicine Hub
    if (isOnConsentPage && hasConsent) {
        return <Navigate to={PATHS.TELEMEDICINE} replace />;
    }

    // Case C: Deterministic state matches location -> Render the clinical view
    return <>{children}</>;
};
