export const isOnboardingCompleted = (): boolean => {
    return localStorage.getItem("haemi_onboarding_completed") === "true";
};

export const completeOnboarding = (): void => {
    localStorage.setItem("haemi_onboarding_completed", "true");
    // Dispatch a custom event so the guard can react globally without a full page reload if necessary.
    window.dispatchEvent(new Event('haemiOnboardingCompleted'));
};
