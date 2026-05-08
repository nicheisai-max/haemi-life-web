import { DateTime } from 'luxon';

/**
 * 🩺 HAEMI LIFE — Timezone Sovereignty Utilities (Phase 2)
 *
 * Luxon-backed, IANA-aware time helpers that replace the orphan
 * `time.utils.ts` module. Every function is timezone-explicit; nothing
 * silently uses the server's local timezone or a hardcoded constant.
 *
 * Architecture model (locked-in 2026-05-08):
 *
 *   Doctor's `clinic_timezone` is the canonical authority for that
 *   doctor's entire scheduling surface. All wall-clock times stored on
 *   the appointment row (`appointment_date`, `appointment_time`) are
 *   interpreted in the doctor's TZ. The UTC anchor
 *   (`appointment_start_utc`) is computed at write time via
 *   `toUtcInstant` for global queries (overdue monitor, audit, admin
 *   cross-TZ reports).
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`.
 *   - All inputs structurally validated; invalid IANA strings throw
 *     a typed `InvalidTimezoneError` that callers narrow on.
 *   - Pure functions — no module-level state, no side effects.
 */

/**
 * Institutional default timezone, applied when no per-doctor TZ has
 * been set yet. Matches the pre-Phase-1 implicit assumption hardcoded
 * in the (now-removed) `time.utils.ts` SYSTEM_TIMEZONE constant. The
 * default is also written into the `doctor_profiles.clinic_timezone`
 * column at the SQL layer (see migration 20260508120000), so this
 * constant is the redundant client-side mirror — both surfaces agree.
 */
export const INSTITUTIONAL_DEFAULT_TIMEZONE: string = 'Africa/Gaborone';

/** Thrown when a non-IANA string is passed where a timezone is required. */
export class InvalidTimezoneError extends Error {
    public readonly timezone: string;
    constructor(timezone: string) {
        super(`Not a valid IANA timezone: ${timezone}`);
        this.name = 'InvalidTimezoneError';
        this.timezone = timezone;
    }
}

/**
 * Validates an IANA timezone string by attempting construction. The
 * Luxon `DateTime.local({ zone })` returns an invalid instance for
 * unknown zones rather than throwing, so we inspect `isValid`
 * explicitly. This avoids the runtime cost of `Intl.DateTimeFormat`
 * construction and keeps validation pure.
 */
export const isValidIanaTimezone = (timezone: string): boolean => {
    if (typeof timezone !== 'string' || timezone.length === 0) return false;
    return DateTime.local({ zone: timezone }).isValid;
};

/**
 * Converts a wall-clock date+time pair (interpreted in `timezone`)
 * into the corresponding absolute UTC instant. Used by the appointment
 * write path to populate `appointment_start_utc` from the
 * `(appointment_date, appointment_time, doctor.clinic_timezone)` triple.
 *
 * @param date  ISO date `YYYY-MM-DD`
 * @param time  24h time `HH:mm` (seconds optional, ignored if present)
 * @param timezone IANA zone (e.g. `Africa/Gaborone`)
 * @throws InvalidTimezoneError if the timezone is not IANA
 * @throws Error if the date/time pair fails to parse
 */
export const toUtcInstant = (date: string, time: string, timezone: string): Date => {
    if (!isValidIanaTimezone(timezone)) {
        throw new InvalidTimezoneError(timezone);
    }
    // Accept HH:mm or HH:mm:ss — strip seconds segment if present so the
    // format string matches the input length deterministically.
    const trimmedTime: string = time.length >= 5 ? time.slice(0, 5) : time;
    const dt: DateTime = DateTime.fromFormat(
        `${date} ${trimmedTime}`,
        'yyyy-MM-dd HH:mm',
        { zone: timezone }
    );
    if (!dt.isValid) {
        throw new Error(`Invalid datetime in ${timezone}: ${date} ${trimmedTime} (${dt.invalidReason ?? 'unknown'})`);
    }
    return dt.toJSDate();
};

/**
 * Returns the current "today" as `YYYY-MM-DD` in the given timezone.
 * Used by the patient-facing `getAvailableSlots` endpoint to determine
 * whether a requested date is in the doctor's past, today, or future —
 * which must respect the doctor's wall clock, not the server's.
 */
export const getTodayInTimezone = (timezone: string): string => {
    if (!isValidIanaTimezone(timezone)) {
        throw new InvalidTimezoneError(timezone);
    }
    return DateTime.now().setZone(timezone).toFormat('yyyy-MM-dd');
};

/**
 * Returns the current minute-of-day (0..1439) in the given timezone.
 * Used as the `earliestMinutes` baseline for same-day slot filtering —
 * a slot is bookable only if its start exceeds NOW + lead-time-minutes
 * in the doctor's wall clock.
 */
export const getNowMinutesInTimezone = (timezone: string): number => {
    if (!isValidIanaTimezone(timezone)) {
        throw new InvalidTimezoneError(timezone);
    }
    const now: DateTime = DateTime.now().setZone(timezone);
    return now.hour * 60 + now.minute;
};

/**
 * Computes whole minutes elapsed between a stored UTC instant and NOW.
 * Used by the appointment overdue monitor to render a human-grade
 * `minutesLate` value in the broadcast payload. Negative deltas (the
 * appointment is still in the future) are clamped to 0 — the monitor
 * only ever fires for already-passed instants, but defensive clamping
 * prevents a negative integer from leaking into the UI in edge cases.
 */
export const minutesLateFromUtc = (utcInstant: Date, now: Date = new Date()): number => {
    const deltaMs: number = now.getTime() - utcInstant.getTime();
    if (deltaMs <= 0) return 0;
    return Math.floor(deltaMs / 60_000);
};

/**
 * Resolves a possibly-null clinic timezone to a usable string. Centralizes
 * the "fall back to institutional default if missing" decision so callers
 * never silently propagate a `null` into Luxon (which would parse as the
 * server's local zone). Returns `INSTITUTIONAL_DEFAULT_TIMEZONE` for
 * `null`/`undefined`/empty-string inputs.
 */
export const resolveClinicTimezone = (raw: string | null | undefined): string => {
    if (typeof raw !== 'string' || raw.length === 0) {
        return INSTITUTIONAL_DEFAULT_TIMEZONE;
    }
    return isValidIanaTimezone(raw) ? raw : INSTITUTIONAL_DEFAULT_TIMEZONE;
};
