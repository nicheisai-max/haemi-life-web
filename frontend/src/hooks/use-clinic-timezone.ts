import { useContext, useMemo } from 'react';
import {
    ClinicTimezoneContext,
    type ClinicTimezoneContextValue,
} from '../context/clinic-timezone-context-def';
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
} from '../utils/clinic-timezone-format';

/**
 * 🌍 HAEMI LIFE — CLINIC TIMEZONE CONSUMER HOOKS
 *
 * Public, consumer-facing API for the clinic-timezone context. Two
 * hooks:
 *
 *   - `useClinicTimezone()` — returns the raw context value
 *     (`clinicTimezone` string + `isHydrated` flag). Use this when
 *     you need to inspect the IANA identifier directly (e.g. the
 *     detection modal compares it against `Intl`-detected browser TZ).
 *
 *   - `useClinicTimezoneFormat()` — returns formatter helpers already
 *     bound to the live `clinicTimezone`. Every doctor-portal surface
 *     that renders a clinical date/time should pull formatters from
 *     here instead of reaching for the global formatter module
 *     directly. This is the contract that keeps the migration uniform:
 *     "the clinic TZ is the doctor's TZ — never specified per-call,
 *     always implicit."
 *
 * STRICT-TS POSTURE
 *
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`.
 *   - Hooks throw a descriptive error when used outside the provider
 *     (same pattern as `useAuth`, `useToast`) — caught at component-
 *     mount time in dev, never silent.
 *   - The bound formatters are memoised against `clinicTimezone` so
 *     consumers can list them in `useMemo` / `useCallback` deps
 *     without triggering spurious re-runs.
 */

export const useClinicTimezone = (): ClinicTimezoneContextValue => {
    const ctx = useContext(ClinicTimezoneContext);
    if (ctx === undefined) {
        throw new Error(
            '[useClinicTimezone] No ClinicTimezoneProvider found in the tree. '
            + 'Wrap the authenticated clinical layout with <ClinicTimezoneProvider> in app.tsx.'
        );
    }
    return ctx;
};

/**
 * Formatters bound to the live clinic timezone. Returned helpers
 * carry the same signatures as the underlying pure functions in
 * `utils/clinic-timezone-format.ts` MINUS the `timezone` parameter
 * — that's bound implicitly from context.
 *
 * Example:
 *   const { formatDate, formatTime } = useClinicTimezoneFormat();
 *   <span>{formatDate(patient.lastVisit)}</span>
 *   <span>{formatTime(appointment.appointmentTime)}</span>
 */
export interface ClinicTimezoneFormatters {
    readonly clinicTimezone: string;
    readonly formatDate: (value: DateLike, options?: Intl.DateTimeFormatOptions, locale?: string) => string;
    readonly formatTime: (value: DateLike, options?: Intl.DateTimeFormatOptions, locale?: string) => string;
    readonly formatDateTime: (value: DateLike, options?: Intl.DateTimeFormatOptions, locale?: string) => string;
    readonly formatDay: (value: DateLike) => string;
    readonly formatMonthShort: (value: DateLike) => string;
    readonly formatNow: (instant?: Date) => string;
    readonly formatOffset: (instant?: Date) => string;
    /**
     * `YYYY-MM-DD` for the current instant in the clinic timezone.
     * Compare against backend wall-clock `appointmentDate` fields to
     * answer "is this appointment today?" without browser-TZ drift.
     */
    readonly todayWallClockDate: (instant?: Date) => string;
}

export const useClinicTimezoneFormat = (): ClinicTimezoneFormatters => {
    const { clinicTimezone } = useClinicTimezone();

    return useMemo<ClinicTimezoneFormatters>(() => ({
        clinicTimezone,
        formatDate: (value, options, locale) => formatDateInTz(value, clinicTimezone, options, locale),
        formatTime: (value, options, locale) => formatTimeInTz(value, clinicTimezone, options, locale),
        formatDateTime: (value, options, locale) => formatDateTimeInTz(value, clinicTimezone, options, locale),
        formatDay: (value) => formatDayInTz(value, clinicTimezone),
        formatMonthShort: (value) => formatMonthShortInTz(value, clinicTimezone),
        formatNow: (instant) => formatNowInTz(clinicTimezone, instant),
        formatOffset: (instant) => formatOffsetInTz(clinicTimezone, instant),
        todayWallClockDate: (instant) => todayWallClockDateInTz(clinicTimezone, instant),
    }), [clinicTimezone]);
};
