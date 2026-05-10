/**
 * timezone-detection-storage.ts
 *
 * Phase 4 — Timezone Sovereignty.
 *
 * Persists the doctor's acknowledgment of the first-time timezone
 * detection prompt — exactly the Windows / macOS post-install pattern
 * (the OS asks once, never again unless storage is reset). Mirrors
 * `onboarding-storage.ts` from the broader first-time-only family.
 *
 * Mechanism:
 *   - Modal interaction (Use Detected / Pick Another / Dismiss) →
 *     `acknowledgeTimezoneDetection()` writes a localStorage flag.
 *   - Subsequent dashboard mounts → `isTimezoneDetectionAcknowledged()`
 *     reads the flag; if set, the modal is suppressed forever on this
 *     device.
 *   - Logout does NOT clear the flag — once a doctor has been prompted,
 *     re-prompting after logout is friction without value.
 *
 * Versioning:
 *   The `_v1` suffix is institutional. A future redesign of the
 *   detection flow can ship under `_v2` and re-prompt every doctor
 *   exactly once.
 *
 * Privacy-strict / quota-exceeded environments:
 *   `localStorage.setItem` / `getItem` may throw in incognito-strict
 *   modes. Both helpers structurally narrow via try/catch and degrade
 *   gracefully — the modal still functions in-session; the next session
 *   may re-prompt, which is acceptable in a hostile-storage environment.
 */

const STORAGE_KEY: string = 'haemi_tz_detection_acknowledged_v1';

export const acknowledgeTimezoneDetection = (): void => {
    try {
        window.localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
        // localStorage unavailable — accept the in-session-only outcome.
        // The modal will not re-mount in this session because component
        // state holds the dismissal; re-prompting next session is the
        // acceptable degradation.
    }
};

export const isTimezoneDetectionAcknowledged = (): boolean => {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
};

/**
 * Returns the browser-detected IANA timezone, or the institutional
 * default if detection fails (extremely old browsers, locked-down
 * runtimes). Keeping the resolution in one helper makes the modal's
 * decision logic single-line.
 */
export const detectBrowserTimezone = (): string => {
    try {
        const detected: string = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return detected.length > 0 ? detected : 'Africa/Gaborone';
    } catch {
        return 'Africa/Gaborone';
    }
};
