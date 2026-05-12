import { createContext } from 'react';

/**
 * 🌍 HAEMI LIFE — CLINIC TIMEZONE CONTEXT (definition only)
 *
 * Definition-only module so the `react-refresh/only-export-components`
 * rule stays clean: the Provider component lives in
 * `clinic-timezone-context.tsx`; consumer hooks live in
 * `hooks/use-clinic-timezone.ts`; type + createContext live here.
 *
 * The context value carries the *live* clinic timezone for the
 * currently-authenticated doctor, plus a hydration flag so consumers
 * (e.g. the detection modal) can wait for the first profile fetch to
 * resolve before evaluating mismatches.
 */
export interface ClinicTimezoneContextValue {
    /**
     * IANA timezone identifier (e.g. `'Africa/Casablanca'`). Always a
     * non-empty string — during the hydration window before the
     * doctor's profile resolves, the institutional default
     * (`'Africa/Gaborone'`) is surfaced so render paths never have to
     * deal with `null`. Use `isHydrated` to distinguish "real value"
     * from "optimistic default".
     */
    readonly clinicTimezone: string;
    /**
     * `true` once the initial `getDoctorProfile()` fetch has resolved
     * (successfully or otherwise). Consumers that need to gate UX on
     * the live value (the TZ detection modal, mismatch-evaluation
     * effects) read this flag before acting.
     */
    readonly isHydrated: boolean;
}

export const ClinicTimezoneContext = createContext<ClinicTimezoneContextValue | undefined>(
    undefined,
);
