import React, { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/use-auth';
import { getDoctorProfile } from '../services/doctor.service';
import { logger } from '../utils/logger';
import {
    INSTITUTIONAL_DEFAULT_CLINIC_TIMEZONE,
} from '../utils/clinic-timezone-format';
import { subscribeToClinicTimezoneUpdates } from '../utils/clinic-timezone-events';
import { ClinicTimezoneContext, type ClinicTimezoneContextValue } from './clinic-timezone-context-def';

/**
 * 🌍 HAEMI LIFE — CLINIC TIMEZONE PROVIDER
 *
 * Owns the live clinic-timezone state for the currently-authenticated
 * doctor and broadcasts changes to every consumer (registry, patient
 * profile, schedule grid, appointments, dashboard, etc.) via React
 * context.
 *
 * Responsibilities:
 *
 *   1. HYDRATION
 *      On mount and whenever the authenticated user's identity
 *      changes, fetch `getDoctorProfile(user.id)` once and seed the
 *      context with `profile.clinicTimezone`. Non-doctor sessions
 *      (patient / pharmacist / admin) skip the fetch and remain on
 *      the institutional default — those roles don't render any
 *      surfaces that depend on this context, but the provider must
 *      still mount cheaply because the dashboard layout is shared.
 *
 *   2. LIVE SYNC
 *      Subscribe to the typed `clinic-timezone:updated` broadcast
 *      (window CustomEvent + BroadcastChannel — see
 *      `utils/clinic-timezone-events.ts`). Same-tab and cross-tab
 *      writes both flow through one subscription. The handler calls
 *      `setClinicTimezone(detail.clinicTimezone)` — React's
 *      referential bail-out makes same-value writes a no-op.
 *
 *   3. SCALABLE FAN-OUT
 *      Memoise the context value so re-renders only propagate when
 *      `clinicTimezone` or `isHydrated` actually change. With dozens
 *      of subscribed surfaces (formatters per row in the registry
 *      list, every appointment card, every schedule slot, etc.) the
 *      memoisation is what keeps the doctor portal performant on a
 *      large panel.
 *
 *   4. AUTH-TRANSITION RESET (via `key` prop)
 *      The outer `<ClinicTimezoneProvider>` keys an inner
 *      `<ClinicTimezoneSession>` on the user's identity tuple. When
 *      the user logs out / logs in as a different doctor, React
 *      unmounts the inner session and remounts a fresh one — initial
 *      state runs from scratch with no `useEffect`-driven sync
 *      setState (which the `react-hooks/set-state-in-effect` rule
 *      correctly flags as a cascading-render risk). This is the
 *      idiomatic React pattern for "reset state on a key change."
 *
 * STRICT-TS POSTURE
 *
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`.
 *   - Profile-fetch error narrowed structurally via `instanceof Error`.
 */

interface ClinicTimezoneProviderProps {
    readonly children: ReactNode;
}

/**
 * Outer wrapper — derives the identity key and forwards everything
 * else to the inner session component. The `key` is what triggers
 * the remount on auth transitions.
 */
export const ClinicTimezoneProvider: React.FC<ClinicTimezoneProviderProps> = ({ children }) => {
    const { user } = useAuth();
    const sessionKey: string = `${user?.id ?? 'anon'}:${user?.role ?? 'none'}`;
    return (
        <ClinicTimezoneSession key={sessionKey}>
            {children}
        </ClinicTimezoneSession>
    );
};

/**
 * Inner session component — mounts fresh on every identity
 * transition (via the outer's `key` prop), so initial state is set
 * via `useState` initializers (no setState-in-effect needed).
 */
const ClinicTimezoneSession: React.FC<ClinicTimezoneProviderProps> = ({ children }) => {
    const { user } = useAuth();
    const userId: string | undefined = user?.id;
    const isDoctor: boolean = user?.role === 'doctor';
    const shouldFetch: boolean = isDoctor && typeof userId === 'string' && userId.length > 0;

    /**
     * Initial state runs at mount time. For non-doctor / unauthenticated
     * sessions we land on the institutional default already-hydrated;
     * for doctor sessions we start on the default but
     * `isHydrated = false` so the detection modal waits.
     */
    const [clinicTimezone, setClinicTimezone] = useState<string>(INSTITUTIONAL_DEFAULT_CLINIC_TIMEZONE);
    const [isHydrated, setIsHydrated] = useState<boolean>(!shouldFetch);

    /**
     * Hydration effect — runs only when we need to fetch (doctor
     * session with a valid userId). All `setState` calls happen
     * inside `.then` / `.catch` callbacks, satisfying the
     * `react-hooks/set-state-in-effect` rule.
     */
    useEffect(() => {
        if (!shouldFetch || typeof userId !== 'string') return;

        let cancelled: boolean = false;

        getDoctorProfile(userId)
            .then(profile => {
                if (cancelled) return;
                if (typeof profile.clinicTimezone === 'string' && profile.clinicTimezone.length > 0) {
                    setClinicTimezone(profile.clinicTimezone);
                }
                setIsHydrated(true);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                logger.warn('[ClinicTimezoneProvider] Profile fetch failed; falling back to default', {
                    error: err instanceof Error ? err.message : String(err),
                });
                setIsHydrated(true);
            });

        return () => {
            cancelled = true;
        };
    }, [shouldFetch, userId]);

    /**
     * Live-sync effect. Subscribes to BOTH same-tab and cross-tab
     * broadcasts via the typed events module. `setClinicTimezone` is
     * referentially stable per React's contract, so the empty dep
     * array is correct and the subscription installs exactly once.
     */
    useEffect(() => {
        return subscribeToClinicTimezoneUpdates(
            (detail) => {
                setClinicTimezone(detail.clinicTimezone);
            },
            () => {
                logger.warn('[ClinicTimezoneProvider] clinic-timezone broadcast carried malformed payload; ignoring');
            },
        );
    }, []);

    const value = useMemo<ClinicTimezoneContextValue>(
        () => ({ clinicTimezone, isHydrated }),
        [clinicTimezone, isHydrated],
    );

    return (
        <ClinicTimezoneContext.Provider value={value}>
            {children}
        </ClinicTimezoneContext.Provider>
    );
};
