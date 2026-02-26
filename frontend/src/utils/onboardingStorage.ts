/**
 * onboardingStorage.ts
 *
 * Fires a browser event to signal that the user chose to skip/complete onboarding.
 * The FirstVisitGuard listens for this event and flips to show Login in-place.
 *
 * No localStorage. No sessionStorage. No persistence.
 * This is intentional — onboarding resets on every page refresh (standard mobile-app pattern).
 */
export const completeOnboarding = (): void => {
    window.dispatchEvent(new Event('haemiOnboardingSkipped'));
};

// Kept for type-compatibility — never read by the guard
export const isOnboardingCompleted = (): boolean => false;
