import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { SuspenseLoaderTrigger } from '@/context/global-loader-context';
import { usePageLoader } from '@/hooks/use-page-loader';
import { isOnboardingCompleted } from '@/utils/onboarding-storage';

const Onboarding = lazy(() =>
    import('../../pages/onboarding/onboarding').then(m => ({ default: m.Onboarding }))
);

interface FirstVisitGuardProps {
    children: React.ReactNode;
}

/**
 * FirstVisitGuard — First-Time-Only Onboarding Gate (Production Posture)
 *
 * Mirrors the Android / iOS / Calendly / Notion / Slack pattern: a
 * never-before-here visitor sees the 3-slide intro once, and never
 * again — across logout, browser close, session expiry, or device
 * restart. The persistence layer is `localStorage` via
 * `onboarding-storage.ts`; this guard is purely the routing reaction.
 *
 * Decision tree (top-to-bottom, first match wins):
 *
 *  1. Auth still resolving       → render nothing; persistent loader is
 *                                   the only visible surface.
 *  2. Authenticated user         → pass through to `children` (Login/
 *                                   Signup will redirect to dashboard
 *                                   via IdentityGate; the guard is
 *                                   transparent here).
 *  3. Onboarding flag persisted  → pass through to `children`. This is
 *                                   the dominant steady-state branch:
 *                                   any returning unauthenticated visitor
 *                                   who has previously completed the
 *                                   intro lands directly on Login.
 *  4. In-session Skip/Continue   → pass through (the carousel just
 *                                   transitioned in-place; no reload).
 *  5. Otherwise                  → render Onboarding lazily via Suspense.
 *
 * Investor demo / UX-check workflow:
 *   - Incognito window           → flag absent, onboarding always shows
 *                                   on first visit (perfect for pitches).
 *   - Normal Chrome              → flag persists across sessions; QA
 *                                   re-trigger via DevTools → Application
 *                                   → Local Storage → delete the key.
 *
 * Persistence detail intentionally lives in `onboarding-storage.ts` so
 * a future v2 redesign can flip the storage key in one place and
 * re-show itself to every user exactly once — no guard surgery.
 */
export const FirstVisitGuard: React.FC<FirstVisitGuardProps> = ({ children }) => {
    const { isLoading, isAuthenticated } = useAuth();

    // In-session escape hatch: the carousel's Skip/Continue dispatches
    // `haemiOnboardingSkipped` and the storage helper writes the flag.
    // We still flip this in-memory state so the same render cycle can
    // transition without waiting for a re-mount that re-reads localStorage.
    const [showLogin, setShowLogin] = useState<boolean>(false);

    useEffect(() => {
        const handleSkip = (): void => setShowLogin(true);
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

    // Returning unauthenticated visitor who has previously completed the
    // intro — the persistent flag is the canonical signal. Once true,
    // the guard is transparent forever (until storage is cleared).
    if (isOnboardingCompleted()) {
        return <>{children}</>;
    }

    // Unauthenticated + fresh-this-session Skip/Continue → show children.
    if (showLogin) {
        return <>{children}</>;
    }

    // Unauthenticated + flag absent + first visit → show Onboarding.
    return (
        <Suspense fallback={<SuspenseLoaderTrigger message="Initializing Haemi Life..." />}>
            <Onboarding />
        </Suspense>
    );
};
