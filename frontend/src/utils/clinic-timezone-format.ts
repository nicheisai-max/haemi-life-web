/**
 * clinic-timezone-format.ts
 *
 * 🌍 HAEMI LIFE — CLINIC-TZ-AWARE DATE/TIME FORMATTERS
 *
 * Pure, side-effect-free formatters that interpret incoming timestamps
 * (ISO strings, Date instances, or `HH:mm`-style time-only strings) in
 * an explicit IANA timezone and render localized display text. Single
 * source of truth for "render this clinical value in the doctor's
 * clinic timezone" — every surface (registry, profile, appointments,
 * dashboard, etc.) routes through these helpers instead of calling
 * the browser-TZ-defaulting `Date.toLocaleString` family.
 *
 * WHY NOT LUXON
 *
 *   The platform already ships `date-fns` for date arithmetic; pulling
 *   in Luxon for IANA formatting would duplicate ~80kB of zone tables
 *   for no benefit. `Intl.DateTimeFormat` with the `timeZone` option
 *   is the V8 / SpiderMonkey / WebKit-native path to IANA-aware
 *   rendering — it uses the OS-level ICU tz database, supports DST
 *   transitions automatically, and is the same engine Luxon delegates
 *   to under the hood.
 *
 * WHY EVERYTHING IS PURE
 *
 *   These helpers are consumed by `useClinicTimezoneFormat()`, which
 *   binds them to the live clinic-TZ context. Keeping the underlying
 *   functions pure means they're trivially testable, memoizable, and
 *   reusable in non-React contexts (audit log exporters, server-side
 *   render pre-formatting, etc.).
 *
 * STRICT-TS POSTURE
 *
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`.
 *   - `formatToParts` results are narrowed structurally via an array
 *     `.find` on `part.type` — never indexed-cast.
 *   - All inputs that may be malformed pass through `coerceToDate()`
 *     which returns `null` on failure; every public formatter handles
 *     the null path explicitly and returns an empty string. Callers
 *     can rely on "no throws".
 */

/**
 * Institutional fallback. Mirrors `INSTITUTIONAL_DEFAULT_TIMEZONE` in
 * `backend/src/utils/timezone.utils.ts`. Exported so the React context
 * can use the same constant for its optimistic-display path before the
 * doctor profile resolves.
 */
export const INSTITUTIONAL_DEFAULT_CLINIC_TIMEZONE: string = 'Africa/Gaborone';

/**
 * Accepted input shapes. Most backend payloads send ISO strings,
 * `appointment.appointmentTime` is `HH:mm` only, and a few legacy
 * surfaces pass `Date` instances directly — every public formatter
 * accepts the union.
 */
export type DateLike = string | number | Date | null | undefined;

/**
 * Coerce a `DateLike` to a `Date` instance. Returns `null` for null,
 * undefined, empty string, or unparseable input. NEVER throws.
 *
 * Time-only inputs (`'14:30'`) are anchored to the unix epoch's date
 * so `Intl.DateTimeFormat` has a complete timestamp to work with; the
 * anchor date is irrelevant because every formatter that accepts a
 * time-only input projects time-only fields. We do NOT pretend a
 * time-only string carries timezone meaning — see `formatTimeInTz`.
 */
const coerceToDate = (value: DateLike): Date | null => {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) {
        return Number.isFinite(value.getTime()) ? value : null;
    }
    if (typeof value === 'number') {
        const d = new Date(value);
        return Number.isFinite(d.getTime()) ? d : null;
    }
    if (typeof value === 'string') {
        if (value.length === 0) return null;
        // `HH:mm` or `HH:mm:ss` — anchor to a stable epoch date so the
        // Date constructor parses successfully under every locale.
        if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
            const d = new Date(`1970-01-01T${value}Z`);
            return Number.isFinite(d.getTime()) ? d : null;
        }
        const d = new Date(value);
        return Number.isFinite(d.getTime()) ? d : null;
    }
    return null;
};

/**
 * Format a date-only display in a given IANA timezone.
 * Default options match the project's prevailing `en-GB` short-date
 * style — callers can override via `options`.
 *
 * Example: `formatDateInTz('2026-05-12T22:00:00Z', 'Asia/Kolkata')`
 *   → `'13/05/2026'` (because 22:00 UTC = 03:30 the next day in IST)
 */
export const formatDateInTz = (
    value: DateLike,
    timezone: string,
    options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' },
    locale: string = 'en-GB',
): string => {
    const d = coerceToDate(value);
    if (d === null) return '';
    try {
        return new Intl.DateTimeFormat(locale, { ...options, timeZone: timezone }).format(d);
    } catch {
        // Invalid IANA zone (extremely rare — would imply context
        // misconfiguration). Fall through to browser TZ rather than
        // crash; surfaces still render something readable.
        return new Intl.DateTimeFormat(locale, options).format(d);
    }
};

/**
 * Format a time-only display in a given IANA timezone.
 *
 * Two input modes:
 *   1. ISO-string / Date / epoch ms → interpreted in `timezone` and
 *      rendered (full TZ semantics, DST-correct).
 *   2. `HH:mm` time-only string → interpreted AS IF it were already
 *      a clinic-local wall-clock time. We render the digits as-is
 *      using `en-GB` and the requested `hour12`. This matches the
 *      backend contract where `appointment.appointmentTime` is the
 *      doctor's clinic-local wall-clock value, NOT a UTC moment.
 */
export const formatTimeInTz = (
    value: DateLike,
    timezone: string,
    options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
    locale: string = 'en-GB',
): string => {
    // Branch 1 — wall-clock time-only string. The clinic-local digits
    // are the canonical truth; rendering them via Intl with a tz
    // option would mis-project them as UTC.
    if (typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
        try {
            return new Intl.DateTimeFormat(locale, options).format(
                new Date(`1970-01-01T${value}`)
            );
        } catch {
            return value.slice(0, 5);
        }
    }

    // Branch 2 — full timestamp; project into the requested zone.
    const d = coerceToDate(value);
    if (d === null) return '';
    try {
        return new Intl.DateTimeFormat(locale, { ...options, timeZone: timezone }).format(d);
    } catch {
        return new Intl.DateTimeFormat(locale, options).format(d);
    }
};

/**
 * Format a combined date + time display in a given IANA timezone.
 * Default style: `dd/MM/yyyy, HH:mm` — matches the project's existing
 * en-GB short style.
 */
export const formatDateTimeInTz = (
    value: DateLike,
    timezone: string,
    options: Intl.DateTimeFormatOptions = {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    },
    locale: string = 'en-GB',
): string => {
    const d = coerceToDate(value);
    if (d === null) return '';
    try {
        return new Intl.DateTimeFormat(locale, { ...options, timeZone: timezone }).format(d);
    } catch {
        return new Intl.DateTimeFormat(locale, options).format(d);
    }
};

/**
 * Extract the day-of-month digit for a given timestamp in a given
 * IANA timezone. Surfaces use this for the big "15" in appointment
 * cards — calling `Date.getDate()` directly returns the browser-local
 * day, which is wrong when the doctor and patient are in different
 * zones. Returns the digit as a string so the caller can render it
 * directly without coercion noise.
 */
export const formatDayInTz = (value: DateLike, timezone: string): string => {
    return formatDateInTz(value, timezone, { day: 'numeric' });
};

/**
 * Extract the short month (e.g. `'May'`) for a given timestamp in a
 * given IANA timezone. Companion to `formatDayInTz` for the calendar-
 * card style.
 */
export const formatMonthShortInTz = (value: DateLike, timezone: string): string => {
    return formatDateInTz(value, timezone, { month: 'short' });
};

/**
 * Live "Currently HH:mm" for a clock-style preview. Companion to
 * `<ClinicTimezoneCard>` and any future surfaces that render a live
 * clinic-local clock. Pure — the consuming component owns the tick
 * cadence.
 */
export const formatNowInTz = (timezone: string, instant: Date = new Date()): string => {
    return formatTimeInTz(instant, timezone, { hour: '2-digit', minute: '2-digit', hour12: false });
};

/**
 * Format a wall-clock date string (`YYYY-MM-DD`) WITHOUT timezone
 * projection. Critical for any backend field stored as a clinic-local
 * calendar date (e.g. `appointment.appointmentDate`) — projecting
 * such a value through `new Date()` interprets it as UTC midnight,
 * and `.getDate()` / `toLocaleDateString()` then return the
 * BROWSER-local day, which can be off-by-one for users west of UTC.
 *
 * If the input doesn't match `YYYY-MM-DD`, we fall through to
 * `formatDateInTz` with UTC so callers can still pass ISO timestamps
 * without checking the shape themselves.
 *
 * Example: `formatWallClockDate('2026-05-15', { day: 'numeric' })`
 *   → `'15'` regardless of browser TZ.
 */
export const formatWallClockDate = (
    value: DateLike,
    options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' },
    locale: string = 'en-GB',
): string => {
    if (typeof value === 'string') {
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
        if (match !== null) {
            // Construct the date in LOCAL time using the parsed YMD —
            // `Intl.DateTimeFormat` without a `timeZone` option then
            // renders directly from the local-wall-clock fields, which
            // are exactly the parsed digits. Off-by-one impossible.
            const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
            try {
                return new Intl.DateTimeFormat(locale, options).format(d);
            } catch {
                return value.slice(0, 10);
            }
        }
    }
    return formatDateInTz(value, 'UTC', options, locale);
};

/**
 * Convenience: extract the day-of-month digit from a wall-clock date
 * string. Companion to `formatWallClockDate` for surfaces that render
 * the big "15" on appointment cards.
 */
export const formatWallClockDay = (value: DateLike): string => {
    return formatWallClockDate(value, { day: 'numeric' });
};

/**
 * Return the `YYYY-MM-DD` string for the current instant projected
 * into a given IANA timezone. Designed for `is this appointment
 * today?` comparisons against backend wall-clock date strings.
 *
 * The locale `'en-CA'` is deliberate — it's the only widely-supported
 * locale that emits `YYYY-MM-DD` from `formatToParts` in zero-padded
 * form, which is exactly what we want to compare against `appointmentDate`.
 *
 * Example: at 23:00 Asia/Kolkata on 2026-05-12 (which is 18:30
 * 2026-05-12 in Africa/Casablanca), `todayWallClockDateInTz('Africa/Casablanca')`
 * returns `'2026-05-12'` — the same calendar date a doctor in
 * Casablanca would expect.
 */
export const todayWallClockDateInTz = (timezone: string, instant: Date = new Date()): string => {
    try {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(instant);
        const y: string = parts.find(p => p.type === 'year')?.value ?? '';
        const m: string = parts.find(p => p.type === 'month')?.value ?? '';
        const d: string = parts.find(p => p.type === 'day')?.value ?? '';
        if (y.length === 4 && m.length === 2 && d.length === 2) {
            return `${y}-${m}-${d}`;
        }
    } catch {
        // Fall through to UTC fallback.
    }
    return instant.toISOString().slice(0, 10);
};

/**
 * Extract the short offset (e.g. `'GMT+1'`, `'GMT+5:30'`) for a given
 * IANA timezone at a given instant. Centralises the `formatToParts`
 * dance and the structural narrowing of the `timeZoneName` part.
 */
export const formatOffsetInTz = (timezone: string, instant: Date = new Date()): string => {
    try {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: timezone,
            timeZoneName: 'shortOffset',
        }).formatToParts(instant);
        const offsetPart = parts.find(p => p.type === 'timeZoneName');
        return offsetPart?.value ?? '';
    } catch {
        return '';
    }
};
