import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { SuspenseLoaderTrigger } from '@/context/global-loader-context';
import { usePageLoader } from '@/hooks/use-page-loader';

const Onboarding = lazy(() =>
    import('../../pages/onboarding/onboarding').then(m => ({ default: m.Onboarding }))
);

interface FirstVisitGuardProps {
    children: React.ReactNode;
}

/**
 * FirstVisitGuard — Standard Mobile-App Onboarding Gate
 *
 * Behavior:
 *  1. Every unauthenticated page load → Onboarding appears first.
 *  2. User clicks Skip / Continue → Login appears immediately (in-place, no reload).
 *  3. Refresh → Onboarding appears again (in-memory state resets on every load).
 *  4. Login succeeds → authenticated → children rendered (IdentityGate redirects to dashboard).
 *  5. Logout → unauthenticated again → Onboarding appears on next load.
 *
 * State: `showLogin` is pure in-memory (useState). It is NOT persisted anywhere.
 * This guarantees: refresh = onboarding, always, for unauthenticated users.
 */
export const FirstVisitGuard: React.FC<FirstVisitGuardProps> = ({ children }) => {
    const { isLoading, isAuthenticated } = useAuth();

    // In-memory only — resets to false on every page refresh by design.
    const [showLogin, setShowLogin] = useState(false);

    // Listen for the skip/complete event fired by completeOnboarding() in onboardingStorage.
    useEffect(() => {
        const handleSkip = () => setShowLogin(true);
        window.addEventListener('haemiOnboardingSkipped', handleSkip);
        return () => window.removeEventListener('haemiOnboardingSkipped', handleSkip);
    }, []);


    // Auth still resolving — drive the persistent loader; render nothing
    // here so the loader's portal-mounted DOM remains the only thing visible.
    usePageLoader(isLoading, 'Initializing Haemi Life...');
    if (isLoading) return null;

    // Authenticated users never see onboarding.
    if (isAuthenticated) {
        return <>{children}</>;
    }

    // Unauthenticated + user clicked Skip/Continue → show Login.
    if (showLogin) {
        return <>{children}</>;
    }

    // Unauthenticated + fresh load → show Onboarding.
    return (
        <Suspense fallback={<SuspenseLoaderTrigger message="Initializing Haemi Life..." />}>
            <Onboarding />
        </Suspense>
    );
};
