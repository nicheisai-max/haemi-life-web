import { useCallback, useEffect, useRef, useState } from 'react';
import { getSystemHealth, type SystemHealth } from '../services/admin.service';
import { logger } from '../utils/logger';

/**
 * 🛡️ HAEMI LIFE — useSystemHealth
 *
 * Polls `GET /admin/system-health` every 5 seconds and exposes the latest
 * snapshot. Used by the admin dashboard's "System Load" card. Polling
 * (rather than socket push) is the correct architecture here — system
 * metrics are CPU-bound on the server side, sampled on read, and the
 * admin doesn't need sub-second freshness for capacity indicators.
 *
 * Lifecycle:
 *   - Fetches once immediately on mount.
 *   - Repeats every 5 seconds while the tab is visible
 *     (`document.visibilityState === 'visible'`).
 *   - Pauses (skips ticks) when the tab is hidden — saves battery and
 *     bandwidth on minimised / background tabs without tearing down the
 *     subscription.
 *   - Stale-while-revalidate: existing snapshot remains rendered during
 *     a refresh tick so the card never flashes "loading" mid-session.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - All errors via `logger`. Zero `console.*`.
 *   - The hook never throws; transient failures are exposed via the
 *     `error` field so the consumer can render a degraded state.
 */

const POLL_INTERVAL_MS = 5_000;

export interface UseSystemHealthResult {
    readonly health: SystemHealth | null;
    readonly isLoading: boolean;
    readonly error: Error | null;
    /** Manually trigger a fresh fetch (e.g. on user-clicked Refresh). */
    readonly refetch: () => Promise<void>;
}

export const useSystemHealth = (): UseSystemHealthResult => {
    const [health, setHealth] = useState<SystemHealth | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const isMountedRef = useRef<boolean>(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const fetchHealth = useCallback(async (): Promise<void> => {
        try {
            const next: SystemHealth = await getSystemHealth();
            if (!isMountedRef.current) return;
            setHealth(next);
            setError(null);
        } catch (e: unknown) {
            const err: Error = e instanceof Error ? e : new Error(String(e));
            logger.error('[useSystemHealth] Fetch failure', {
                message: err.message,
            });
            if (!isMountedRef.current) return;
            setError(err);
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        // Initial fetch on mount. The `void` is intentional: the
        // returned Promise's resolution is captured via state updates
        // inside the function, so awaiting at the call site would only
        // serve to add lint noise.
        void fetchHealth();

        const intervalId = setInterval(() => {
            // Pause polling while the tab is hidden — saves battery and
            // bandwidth, mirrors the behaviour of `useAdminLiveTable`'s
            // poll fallback for consistency across admin surfaces.
            if (document.visibilityState !== 'visible') return;
            void fetchHealth();
        }, POLL_INTERVAL_MS);

        return () => {
            clearInterval(intervalId);
        };
    }, [fetchHealth]);

    return {
        health,
        isLoading,
        error,
        refetch: fetchHealth,
    };
};
