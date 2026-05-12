/**
 * timezone-detection-storage.ts
 *
 * Phase 4 — Timezone Sovereignty (v2 — Session-Scoped Mismatch Ack).
 *
 * Persists the doctor's acknowledgment of the timezone-detection prompt
 * with three institutional properties absent from v1:
 *
 *   1. SESSION-SCOPED, NOT DEVICE-PERMANENT
 *      v1 wrote a single `haemi_tz_detection_acknowledged_v1` flag to
 *      `localStorage` and short-circuited the modal forever on that
 *      device. That broke the most basic doctor workflow: a doctor
 *      who logs out, logs in again, or travels to a different
 *      timezone never saw the prompt again. v2 uses `sessionStorage`,
 *      which is wiped on tab close + explicitly drained on logout
 *      (see `clearAllTimezoneDetectionAcks`).
 *
 *   2. MISMATCH-KEYED
 *      v1's single flag couldn't distinguish "doctor acked the
 *      Africa/Casablanca vs Asia/Kolkata mismatch" from "doctor is now
 *      seeing a Europe/Paris vs Africa/Casablanca mismatch". v2 keys
 *      the ack by the exact mismatch tuple
 *      `(userId, browserTz, clinicTz)`. If any of those three change,
 *      the ack invalidates and the modal re-fires.
 *
 *   3. PER-USER, NOT PER-BROWSER
 *      v1 leaked ack state between doctors using the same browser.
 *      v2's key includes `userId` so each clinician gets their own
 *      ack ledger.
 *
 * Mechanism:
 *   - Modal interaction (Use Detected / Pick Another / Dismiss) →
 *     `acknowledgeTimezoneDetection({ userId, browserTz, clinicTz })`
 *     writes a sessionStorage entry under the mismatch key.
 *   - Subsequent dashboard/schedule mounts →
 *     `isTimezoneDetectionAcknowledged({ userId, browserTz, clinicTz })`
 *     reads the mismatch key; modal suppressed only when EVERY part
 *     of the tuple still matches.
 *   - Logout → `clearAllTimezoneDetectionAcks()` drains every entry
 *     under the `haemi_tz_ack_v2:` prefix so the next login starts
 *     fresh.
 *
 * Privacy-strict / quota-exceeded environments:
 *   `sessionStorage` may throw in incognito-strict modes. Every
 *   helper structurally narrows via try/catch and degrades gracefully
 *   — the modal still functions in-session via component state; the
 *   next session re-prompts (acceptable in a hostile-storage
 *   environment).
 */

const STORAGE_KEY_PREFIX: string = 'haemi_tz_ack_v2:';

/**
 * Input tuple uniquely identifying the mismatch a doctor has
 * decided about. Any change to any field invalidates the ack and
 * re-fires the modal.
 */
export interface TimezoneAckKey {
    readonly userId: string;
    readonly browserTz: string;
    readonly clinicTz: string;
}

/**
 * Compose the canonical sessionStorage key. Kept private so the key
 * shape is changeable without consumers touching the call site.
 */
const buildKey = ({ userId, browserTz, clinicTz }: TimezoneAckKey): string => {
    return `${STORAGE_KEY_PREFIX}${userId}:${browserTz}:${clinicTz}`;
};

export const acknowledgeTimezoneDetection = (key: TimezoneAckKey): void => {
    try {
        window.sessionStorage.setItem(buildKey(key), 'true');
    } catch {
        // sessionStorage unavailable (incognito-strict, quota exceeded).
        // Accept the in-session-only outcome — the modal won't re-mount
        // in this render cycle because component state holds the
        // dismissal; re-prompting next session is the acceptable
        // degradation.
    }
};

export const isTimezoneDetectionAcknowledged = (key: TimezoneAckKey): boolean => {
    try {
        return window.sessionStorage.getItem(buildKey(key)) === 'true';
    } catch {
        return false;
    }
};

/**
 * Drain every timezone-ack entry from sessionStorage. Called from the
 * auth-context `logout` flow so the next login (even same user, same
 * browser tab) starts with a fresh evaluation.
 *
 * Iterates a snapshot of the key list rather than mutating during
 * iteration — `sessionStorage.removeItem` shifts indices on Chromium,
 * so the snapshot pattern is the safe one.
 */
export const clearAllTimezoneDetectionAcks = (): void => {
    try {
        const storage: Storage = window.sessionStorage;
        const matchingKeys: string[] = [];
        for (let i = 0; i < storage.length; i++) {
            const candidate: string | null = storage.key(i);
            if (candidate !== null && candidate.startsWith(STORAGE_KEY_PREFIX)) {
                matchingKeys.push(candidate);
            }
        }
        for (const k of matchingKeys) storage.removeItem(k);
    } catch {
        // sessionStorage unavailable — nothing to clear, nothing to
        // log. Logout proceeds unaffected.
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
