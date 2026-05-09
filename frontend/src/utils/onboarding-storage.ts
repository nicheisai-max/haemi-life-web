/**
 * onboardingStorage.ts
 *
 * Production-grade first-time-only onboarding persistence — mirrors the
 * pattern every Android / iOS / web app uses (Calendly, Notion, Slack):
 * a user sees the intro carousel ONCE and never again, regardless of
 * logout, browser close, or session expiry.
 *
 * Mechanism:
 *   - Skip / Continue / Get Started click → `completeOnboarding()` writes
 *     `localStorage[STORAGE_KEY] = 'true'` AND fires the
 *     `haemiOnboardingSkipped` event so the guard transitions in-session.
 *   - Subsequent visits → `isOnboardingCompleted()` reads the flag.
 *   - Logout does NOT clear the flag — once you've seen the intro, you've
 *     seen it. Re-showing it after logout is friction without value.
 *
 * Demo & UX-check workflow:
 *   - Investor demos → use an incognito window (fresh storage every
 *     session, onboarding always shows on first visit).
 *   - Normal Chrome for UX checks → onboarding shows once, then bypassed.
 *     To re-trigger for QA: DevTools → Application → Local Storage →
 *     delete the key below.
 *
 * Versioning:
 *   The key carries a `_v1` suffix so a future redesign of the
 *   onboarding (new slides, new intro) can ship under `_v2` and re-show
 *   itself to every user exactly once. Institutional pattern — every
 *   pre-login content gate that persists state should be versioned.
 *
 * Privacy-strict / quota-exceeded environments (incognito-strict,
 * Brave Shields aggressive, Safari ITP):
 *   `localStorage.setItem` / `getItem` may throw. Both helpers
 *   structurally narrow via try/catch and degrade gracefully — the
 *   in-session event still fires from `completeOnboarding()` so the
 *   user can proceed past the gate even if persistence is blocked.
 */

const STORAGE_KEY: string = 'haemi_onboarding_completed_v1';

export const completeOnboarding = (): void => {
    try {
        window.localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
        // localStorage unavailable (privacy-strict, quota-exceeded). The
        // event below still fires so the guard transitions in this
        // session — the doctor / patient won't be wedged on the carousel.
        // Next session may show onboarding again, which is acceptable
        // degradation in a hostile-storage environment.
    }
    window.dispatchEvent(new Event('haemiOnboardingSkipped'));
};

export const isOnboardingCompleted = (): boolean => {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
};
