import React, { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/use-auth';
import { getPlatformTimezone as fetchPlatformTimezone } from '../services/platform.service';
import { socketService } from '../services/socket.service';
import { logger } from '../utils/logger';
import {
    INSTITUTIONAL_DEFAULT_PLATFORM_TIMEZONE,
} from '../utils/platform-timezone-format';
import {
    subscribeToPlatformTimezoneUpdates,
    dispatchPlatformTimezoneUpdated,
} from '../utils/platform-timezone-events';
import { PlatformTimezoneContext, type PlatformTimezoneContextValue } from './platform-timezone-context-def';

/**
 * 🌍 HAEMI LIFE — PLATFORM TIMEZONE PROVIDER (Phase 5 — Timezone Sovereignty)
 *
 * Owns the live platform-wide timezone state for the
 * currently-authenticated session and broadcasts changes to every
 * consumer (registry, patient profile, schedule grid, appointments,
 * audit logs, etc.) via React context. The platform timezone is now
 * the SINGLE source of truth across every role — patient, doctor,
 * pharmacist, admin — replacing the per-doctor `clinic_timezone`
 * model that Phase 4c shipped.
 *
 * RESPONSIBILITIES
 *
 *   1. HYDRATION
 *      On every authenticated mount (regardless of role), fetch
 *      `GET /api/platform/timezone` once and seed the context with the
 *      server-canonical value. Unauthenticated sessions skip the fetch
 *      and remain on the institutional default — they don't render any
 *      surfaces that depend on this context.
 *
 *   2. LIVE SYNC — THREE TRANSPORTS
 *        (a) `window.dispatchEvent` — same-tab, synchronous.
 *        (b) `BroadcastChannel('haemi-platform-timezone')` — cross-tab,
 *            same-origin.
 *        (c) Socket.IO `'platform-timezone:updated'` — cross-CLIENT.
 *            When the admin saves a new TZ, the backend emits to every
 *            connected socket (any role, any tab, any device); each
 *            client's provider receives the event and updates context,
 *            cascading the change through every TZ-aware surface
 *            WITHOUT a reload.
 *
 *   3. AUTH-TRANSITION RESET (via `key` prop)
 *      The outer `<PlatformTimezoneProvider>` keys an inner
 *      `<PlatformTimezoneSession>` on the user's identity tuple.
 *      Login / logout / switch-user remounts the inner session — fresh
 *      initial state, zero leaked listeners.
 *
 *   4. SCALABLE FAN-OUT
 *      Memoised context value; same-value writes referentially bail
 *      out at every consumer. Performant on dashboards with hundreds
 *      of date-rendering rows.
 *
 * STRICT-TS POSTURE
 *
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`,
 *     zero `eslint-disable`.
 *   - Wire-boundary `unknown` (fetch errors, socket payloads) narrowed
 *     structurally via `instanceof Error` + property-existence guards.
 *   - `setState` only in callbacks (Promise resolve/reject, socket
 *     handlers, broadcast handlers) — never synchronously in effect
 *     bodies. The `key`-prop pattern handles auth-transition reset
 *     without needing setState-in-effect.
 */

interface PlatformTimezoneProviderProps {
    readonly children: ReactNode;
}

/**
 * Outer wrapper — derives the identity key and forwards everything
 * else to the inner session component. The `key` is what triggers
 * the remount on auth transitions.
 */
export const PlatformTimezoneProvider: React.FC<PlatformTimezoneProviderProps> = ({ children }) => {
    const { user } = useAuth();
    const sessionKey: string = `${user?.id ?? 'anon'}:${user?.role ?? 'none'}`;
    return (
        <PlatformTimezoneSession key={sessionKey}>
            {children}
        </PlatformTimezoneSession>
    );
};

/**
 * Inner session component — mounts fresh on every identity
 * transition (via the outer's `key` prop), so initial state is set
 * via `useState` initializers (no setState-in-effect needed).
 */
const PlatformTimezoneSession: React.FC<PlatformTimezoneProviderProps> = ({ children }) => {
    const { user } = useAuth();
    const isAuthenticated: boolean = typeof user?.id === 'string' && user.id.length > 0;

    /**
     * Initial state runs at mount time. Every role lands on the
     * institutional default optimistically; for authenticated sessions
     * the network fetch flips it to the canonical platform TZ;
     * unauthenticated sessions stay on default and mark hydrated.
     */
    const [platformTimezone, setPlatformTimezone] = useState<string>(INSTITUTIONAL_DEFAULT_PLATFORM_TIMEZONE);
    const [isHydrated, setIsHydrated] = useState<boolean>(!isAuthenticated);

    /**
     * Hydration effect — fetches the canonical platform TZ from the
     * backend on every authenticated mount. All `setState` calls
     * happen inside `.then` / `.catch` callbacks; the
     * `react-hooks/set-state-in-effect` rule passes cleanly.
     */
    useEffect(() => {
        if (!isAuthenticated) return;

        let cancelled: boolean = false;

        fetchPlatformTimezone()
            .then(response => {
                if (cancelled) return;
                if (typeof response.platformTimezone === 'string' && response.platformTimezone.length > 0) {
                    setPlatformTimezone(response.platformTimezone);
                }
                setIsHydrated(true);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                logger.warn('[PlatformTimezoneProvider] Fetch failed; falling back to default', {
                    error: err instanceof Error ? err.message : String(err),
                });
                setIsHydrated(true);
            });

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated]);

    /**
     * Same-tab + cross-tab live sync. Subscribes to BOTH the
     * `window.dispatchEvent` channel AND the `BroadcastChannel`
     * transport via one helper. `setPlatformTimezone` is
     * referentially stable per React's contract; the empty dep array
     * is correct.
     */
    useEffect(() => {
        return subscribeToPlatformTimezoneUpdates(
            (detail) => {
                setPlatformTimezone(detail.platformTimezone);
            },
            () => {
                logger.warn('[PlatformTimezoneProvider] platform-timezone broadcast carried malformed payload; ignoring');
            },
        );
    }, []);

    /**
     * Cross-CLIENT live sync via Socket.IO. The admin's TZ-update
     * emits `'platform-timezone:updated'` to every connected socket;
     * we receive it here on every other client and forward into the
     * SAME local broadcast pipeline (so any other listeners on this
     * tab — and other tabs via BroadcastChannel — see the change).
     *
     * Auth-gated: we only subscribe when the user is authenticated
     * (sockets only connect post-auth). Unmount cleans up.
     */
    useEffect(() => {
        if (!isAuthenticated) return;

        const handler = (payload: { readonly platformTimezone: string }): void => {
            // Forward into the local + cross-tab broadcast so every
            // consumer on every tab in this browser converges. The
            // provider's own broadcast listener (above) will pick up
            // this dispatch and call setState; we don't need to call
            // it directly here.
            if (typeof payload.platformTimezone === 'string' && payload.platformTimezone.length > 0) {
                dispatchPlatformTimezoneUpdated(payload.platformTimezone);
            }
        };

        socketService.on('platform-timezone:updated', handler);
        return () => {
            socketService.off('platform-timezone:updated', handler);
        };
    }, [isAuthenticated]);

    const value = useMemo<PlatformTimezoneContextValue>(
        () => ({ platformTimezone, isHydrated }),
        [platformTimezone, isHydrated],
    );

    return (
        <PlatformTimezoneContext.Provider value={value}>
            {children}
        </PlatformTimezoneContext.Provider>
    );
};
