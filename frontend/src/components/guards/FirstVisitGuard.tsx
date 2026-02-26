import React, { useState, useEffect, Suspense, lazy } from 'react';
import { isOnboardingCompleted } from '../../utils/onboardingStorage';
import { MedicalLoader } from '../ui/MedicalLoader';

// Lazy load the onboarding screen to keep the initial JS bundle small for returning users
const Onboarding = lazy(() => import('../../pages/onboarding/Onboarding').then(m => ({ default: m.Onboarding })));

interface FirstVisitGuardProps {
    children: React.ReactNode;
}

export const FirstVisitGuard: React.FC<FirstVisitGuardProps> = ({ children }) => {
    // Determine initial state immediately to avoid layout flicker
    const [completed, setCompleted] = useState<boolean>(isOnboardingCompleted);

    useEffect(() => {
        // Listen for the custom event emitted when onboarding is finished
        const handleOnboardingCompleted = () => {
            setCompleted(true);
        };

        window.addEventListener('haemiOnboardingCompleted', handleOnboardingCompleted);
        return () => window.removeEventListener('haemiOnboardingCompleted', handleOnboardingCompleted);
    }, []);

    // If onboarding is NOT completed, intercept rendering and show the Onboarding flow
    if (!completed) {
        return (
            <Suspense fallback={<MedicalLoader fullPage message="Initializing Haemi Life..." />}>
                <Onboarding />
            </Suspense>
        );
    }

    // If completed, render the original children seamlessly (e.g., Login or IdentityGate)
    return <>{children}</>;
};
