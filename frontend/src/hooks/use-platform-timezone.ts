import { useContext, useMemo } from 'react';
import {
    PlatformTimezoneContext,
    type PlatformTimezoneContextValue,
} from '../context/platform-timezone-context-def';
import {
    formatDateInTz,
    formatTimeInTz,
    formatDateTimeInTz,
    formatDayInTz,
    formatMonthShortInTz,
    formatNowInTz,
    formatOffsetInTz,
    todayWallClockDateInTz,
    type DateLike,
} from '../utils/platform-timezone-format';

/**
 * 🌍 HAEMI LIFE — PLATFORM TIMEZONE CONSUMER HOOKS
 *
 * Public, consumer-facing API for the platform-timezone context. Two
 * hooks:
 *
 *   - `usePlatformTimezone()` — returns the raw context value
 *     (`platformTimezone` string + `isHydrated` flag). Use this when
 *     you need to inspect the IANA identifier directly (e.g. the
 *     admin detection modal compares it against `Intl`-detected
 *     browser TZ).
 *
 *   - `usePlatformTimezoneFormat()` — returns formatter helpers
 *     already bound to the live `platformTimezone`. Every surface
 *     that renders a clinical date/time should pull formatters from
 *     here instead of reaching for the global formatter module
 *     directly. This is the contract that keeps the migration
 *     uniform: "the platform TZ is implicit — never specified
 *     per-call."
 *
 * STRICT-TS POSTURE
 *
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`.
 *   - Hooks throw a descriptive error when used outside the provider
 *     (same pattern as `useAuth`, `useToast`) — caught at component-
 *     mount time in dev, never silent.
 *   - The bound formatters are memoised against `platformTimezone`
 *     so consumers can list them in `useMemo` / `useCallback` deps
 *     without triggering spurious re-runs.
 */

export const usePlatformTimezone = (): PlatformTimezoneContextValue => {
    const ctx = useContext(PlatformTimezoneContext);
    if (ctx === undefined) {
        throw new Error(
            '[usePlatformTimezone] No PlatformTimezoneProvider found in the tree. '
            + 'Wrap the authenticated clinical layout with <PlatformTimezoneProvider> in app.tsx.'
        );
    }
    return ctx;
};

/**
 * Formatters bound to the live platform timezone. Returned helpers
 * carry the same signatures as the underlying pure functions in
 * `utils/platform-timezone-format.ts` MINUS the `timezone` parameter
 * — that's bound implicitly from context.
 *
 * Example:
 *   const { formatDate, formatTime } = usePlatformTimezoneFormat();
 *   <span>{formatDate(patient.lastVisit)}</span>
 *   <span>{formatTime(appointment.appointmentTime)}</span>
 */
export interface PlatformTimezoneFormatters {
    readonly platformTimezone: string;
    readonly formatDate: (value: DateLike, options?: Intl.DateTimeFormatOptions, locale?: string) => string;
    readonly formatTime: (value: DateLike, options?: Intl.DateTimeFormatOptions, locale?: string) => string;
    readonly formatDateTime: (value: DateLike, options?: Intl.DateTimeFormatOptions, locale?: string) => string;
    readonly formatDay: (value: DateLike) => string;
    readonly formatMonthShort: (value: DateLike) => string;
    readonly formatNow: (instant?: Date) => string;
    readonly formatOffset: (instant?: Date) => string;
    /**
     * `YYYY-MM-DD` for the current instant in the platform timezone.
     * Compare against backend wall-clock `appointmentDate` fields to
     * answer "is this appointment today?" without browser-TZ drift.
     */
    readonly todayWallClockDate: (instant?: Date) => string;
}

export const usePlatformTimezoneFormat = (): PlatformTimezoneFormatters => {
    const { platformTimezone } = usePlatformTimezone();

    return useMemo<PlatformTimezoneFormatters>(() => ({
        platformTimezone,
        formatDate: (value, options, locale) => formatDateInTz(value, platformTimezone, options, locale),
        formatTime: (value, options, locale) => formatTimeInTz(value, platformTimezone, options, locale),
        formatDateTime: (value, options, locale) => formatDateTimeInTz(value, platformTimezone, options, locale),
        formatDay: (value) => formatDayInTz(value, platformTimezone),
        formatMonthShort: (value) => formatMonthShortInTz(value, platformTimezone),
        formatNow: (instant) => formatNowInTz(platformTimezone, instant),
        formatOffset: (instant) => formatOffsetInTz(platformTimezone, instant),
        todayWallClockDate: (instant) => todayWallClockDateInTz(platformTimezone, instant),
    }), [platformTimezone]);
};
