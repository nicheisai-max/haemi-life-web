import { createContext } from 'react';

/**
 * 🌍 HAEMI LIFE — PLATFORM TIMEZONE CONTEXT (definition only)
 *
 * Definition-only module so the `react-refresh/only-export-components`
 * rule stays clean: the Provider component lives in
 * `platform-timezone-context.tsx`; consumer hooks live in
 * `hooks/use-platform-timezone.ts`; type + createContext live here.
 *
 * The context value carries the *live* platform timezone for the
 * currently-authenticated session (single source of truth governed
 * exclusively by the admin role), plus a hydration flag so consumers
 * (e.g. the admin detection modal) can wait for the first fetch to
 * resolve before evaluating mismatches.
 */
export interface PlatformTimezoneContextValue {
    /**
     * IANA timezone identifier (e.g. `'Africa/Casablanca'`). Always a
     * non-empty string — during the hydration window before the
     * platform timezone resolves, the institutional default
     * (`'Africa/Gaborone'`) is surfaced so render paths never have to
     * deal with `null`. Use `isHydrated` to distinguish "real value"
     * from "optimistic default".
     */
    readonly platformTimezone: string;
    /**
     * `true` once the initial `/api/platform/timezone` fetch has
     * resolved (successfully or otherwise). Consumers that need to
     * gate UX on the live value (the admin TZ detection modal,
     * mismatch-evaluation effects) read this flag before acting.
     */
    readonly isHydrated: boolean;
}

export const PlatformTimezoneContext = createContext<PlatformTimezoneContextValue | undefined>(
    undefined,
);
