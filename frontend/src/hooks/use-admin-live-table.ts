import { useCallback, useEffect, useRef, useState } from 'react';
import { socketService } from '../services/socket.service';
import { logger } from '../utils/logger';
import {
    AdminEventName,
    AdminEventMap,
    AdminEventSchemaMap,
} from '../../../shared/schemas/admin-events.schema';

/**
 * Per-event subscribe/unsubscribe dispatch table. Mirrors the backend's
 * `ADMIN_EMIT_DISPATCH` design: each entry uses a *literal* event-name
 * string in the inner `socketService.on/off` call so TypeScript resolves
 * the typed callback signature precisely — no generic-variance casts,
 * no `as unknown as`.
 *
 * Adding a new admin event:
 *   1. Add its name + payload type in `shared/schemas/admin-events.schema.ts`.
 *   2. Add a row to `ADMIN_SUBSCRIBE_DISPATCH` below.
 * The `satisfies` clause guarantees the table is exhaustive.
 */
type AdminSubscribeDispatch = {
    [E in AdminEventName]: (handler: (payload: AdminEventMap[E]) => void) => () => void;
};

const ADMIN_SUBSCRIBE_DISPATCH = {
    'screening:reordered': (handler) => {
        socketService.on('screening:reordered', handler);
        return () => socketService.off('screening:reordered', handler);
    },
} as const satisfies AdminSubscribeDispatch;

/**
 * 🛡️ HAEMI LIFE — useAdminLiveTable
 *
 * Reusable hook for admin pages that need to display a server-side list and
 * keep it live via socket events. One implementation replaces what would
 * otherwise be 7 page-specific socket-integration patterns.
 *
 * Architecture:
 *   1. **Initial fetch** on mount via the supplied `fetcher`. Errors are
 *      caught and surfaced through the `error` state — never thrown to a
 *      React error boundary (admin pages must remain operational even if
 *      a single fetch fails).
 *
 *   2. **Live updates** via `subscribeEvents`. Every event listed there is
 *      attached to the existing `socketService`, payloads are validated at
 *      runtime through `AdminEventSchemaMap[event]`, and the consumer's
 *      `onEvent` callback is invoked with a *narrowed* payload type. Drift
 *      between backend emit and frontend consumption never reaches render.
 *
 *   3. **Polling fallback** when `socketService.isConnected()` is false.
 *      Configurable via `pollFallbackMs` (defaults to 30s) — long enough to
 *      avoid thrashing on flaky networks, short enough that an admin
 *      checking a dashboard is never staring at minutes-stale data. The
 *      poll is paused while the tab is hidden (`document.visibilityState`)
 *      to save battery and bandwidth.
 *
 *   4. **No `any`, no double cast, no @ts-ignore.** The generic `T` is
 *      constrained to a row with an `id: string` so React keys and
 *      duplicate-row reconciliation work without fallback logic. Every
 *      `unknown` payload is narrowed by Zod before reaching `onEvent`.
 *
 *   5. **All errors via `logger.error`.** The hook never `console.*`s.
 *
 * Phase 1 ships the scaffold; Phase 2 onward will add consumers
 * (Audit Logs, Sessions, Security Events, etc.).
 */

const DEFAULT_POLL_FALLBACK_MS = 30_000;

export interface UseAdminLiveTableConfig<T extends { id: string }, E extends AdminEventName> {
    /**
     * Async fetcher returning the current page of rows. Called on mount,
     * on `refetch()`, and on every poll-fallback tick (when the socket is
     * disconnected). MUST throw on transport errors so the hook can surface
     * them — do not swallow inside the fetcher.
     */
    readonly fetcher: () => Promise<ReadonlyArray<T>>;

    /**
     * Admin event names this consumer is interested in. The hook subscribes
     * to each, validates incoming payloads against `AdminEventSchemaMap`,
     * and invokes `onEvent` with the narrowed payload. Pass an empty array
     * for fetch-only mode (no live updates).
     */
    readonly subscribeEvents: ReadonlyArray<E>;

    /**
     * Called once per validated socket event. Return the new `items` array.
     * Receive the current `items` for in-place updates, removals, or
     * re-fetches. If you only need to trigger a re-fetch (most common
     * pattern when payloads are intentionally lean), return `null` and the
     * hook will call `refetch()` on your behalf.
     */
    readonly onEvent?: (
        event: E,
        payload: AdminEventMap[E],
        currentItems: ReadonlyArray<T>
    ) => ReadonlyArray<T> | null;

    /**
     * Poll cadence (ms) used ONLY when `socketService.isConnected()` is
     * false. Defaults to 30 seconds. Set to 0 to disable poll fallback
     * entirely (data is then static after the initial fetch when offline).
     */
    readonly pollFallbackMs?: number;
}

export interface UseAdminLiveTableResult<T extends { id: string }> {
    readonly items: ReadonlyArray<T>;
    readonly isLoading: boolean;
    readonly error: Error | null;
    readonly refetch: () => Promise<void>;
}

export function useAdminLiveTable<T extends { id: string }, E extends AdminEventName>(
    config: UseAdminLiveTableConfig<T, E>
): UseAdminLiveTableResult<T> {
    const {
        fetcher,
        subscribeEvents,
        onEvent,
        pollFallbackMs = DEFAULT_POLL_FALLBACK_MS,
    } = config;

    const [items, setItems] = useState<ReadonlyArray<T>>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    // Latest items in a ref so the socket-event handler always sees the
    // current state without forcing a re-subscription cycle on every change.
    const itemsRef = useRef<ReadonlyArray<T>>([]);
    itemsRef.current = items;

    const isMountedRef = useRef<boolean>(true);

    const refetch = useCallback(async (): Promise<void> => {
        try {
            const next = await fetcher();
            if (!isMountedRef.current) return;
            setItems(next);
            setError(null);
        } catch (e: unknown) {
            const err: Error = e instanceof Error ? e : new Error(String(e));
            logger.error('[useAdminLiveTable] Fetch failure', {
                message: err.message,
            });
            if (!isMountedRef.current) return;
            setError(err);
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, [fetcher]);

    // ─── Initial mount + lifecycle guard ─────────────────────────────────────
    useEffect(() => {
        isMountedRef.current = true;
        void refetch();
        return () => {
            isMountedRef.current = false;
        };
    }, [refetch]);

    // ─── Socket subscriptions ────────────────────────────────────────────────
    useEffect(() => {
        if (subscribeEvents.length === 0) return;

        // Each cleanup function unsubscribes the corresponding event when
        // the effect tears down. Built per-event through
        // `ADMIN_SUBSCRIBE_DISPATCH` so each `socketService.on/off` call
        // sees a literal event name and the typed callback signature
        // resolves precisely — no generic-variance casts.
        const cleanups: Array<() => void> = subscribeEvents.map((event) => {
            const schema = AdminEventSchemaMap[event];

            // Validate every incoming payload as defense-in-depth against
            // backend type drift. Even if the wire shape diverges from the
            // declared contract, the page does not crash — the bad payload
            // is logged and discarded, and the fallback poll keeps data
            // fresh.
            const handler = (payload: AdminEventMap[E]): void => {
                const result = schema.safeParse(payload);
                if (!result.success) {
                    logger.error('[useAdminLiveTable] Payload validation failed', {
                        event,
                        issues: JSON.stringify(result.error.issues),
                    });
                    return;
                }
                const validated: AdminEventMap[E] = result.data;
                if (onEvent) {
                    const next = onEvent(event, validated, itemsRef.current);
                    if (next === null) {
                        void refetch();
                    } else if (isMountedRef.current) {
                        setItems(next);
                    }
                } else {
                    // No custom handler — default behaviour is to re-fetch.
                    void refetch();
                }
            };

            const subscribe = ADMIN_SUBSCRIBE_DISPATCH[event];
            return subscribe(handler);
        });

        return () => {
            for (const cleanup of cleanups) cleanup();
        };
    }, [subscribeEvents, onEvent, refetch]);

    // ─── Polling fallback when socket is disconnected ────────────────────────
    useEffect(() => {
        if (pollFallbackMs <= 0) return;

        let intervalId: ReturnType<typeof setInterval> | null = null;

        const tick = (): void => {
            if (!isMountedRef.current) return;
            if (document.visibilityState !== 'visible') return; // pause when tab hidden
            if (socketService.isConnected()) return; // socket-driven mode is authoritative
            void refetch();
        };

        intervalId = setInterval(tick, pollFallbackMs);
        return () => {
            if (intervalId !== null) clearInterval(intervalId);
        };
    }, [pollFallbackMs, refetch]);

    return { items, isLoading, error, refetch };
}
