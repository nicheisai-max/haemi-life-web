import { useCallback, useEffect, useRef, useState } from 'react';
import { socketService } from '../services/socket.service';
import { logger } from '../utils/logger';
import {
    AdminEventName,
    AdminEventMap,
    AdminEventSchemaMap,
    ScreeningReorderedEventSchema,
    AuditLogEventSchema,
    SecurityEventSchema,
    SessionCreatedEventSchema,
    SessionRevokedEventSchema,
    DoctorVerifiedEventSchema,
    type ScreeningReorderedEvent,
    type AuditLogEvent,
    type SecurityEvent,
    type SessionCreatedEvent,
    type SessionRevokedEvent,
    type DoctorVerifiedEvent,
} from '../../../shared/schemas/admin-events.schema';

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
 *      attached to the existing `socketService` through a per-event switch
 *      that dispatches to literal-named subscribe helpers — generic-variance
 *      pitfalls are avoided by never indexing through a generic E.
 *      Payloads are Zod-validated at the consumer boundary (defense-in-depth
 *      against backend type drift).
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
 *      payload is Zod-validated before reaching `onEvent`. The hand-off
 *      from the literal-typed handler to the consumer's generic `onEvent`
 *      uses a single targeted `as` cast — *not* `as unknown as` — at a
 *      documented variance boundary, with the runtime invariant that the
 *      Zod parse just succeeded for this exact event/payload pair.
 *
 *   5. **All errors via `logger.error`.** The hook never `console.*`s.
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

/**
 * Per-event subscribe helper. Each branch uses literal event-name strings
 * so `socketService.on/off` resolve to precisely-typed signatures — the
 * generic-variance issue that bites mapped-type dispatch tables is avoided
 * entirely. Returns the unsubscribe closure for the caller's cleanup list.
 *
 * Adding a new event = add one `case` here, one entry to
 * `shared/schemas/admin-events.schema.ts`, plus the matching schema parse
 * in `parseAdminEventPayload` below. The exhaustive `never` default
 * surfaces missing branches as a compile error.
 */
const subscribeOne = (
    event: AdminEventName,
    handlers: {
        onScreeningReordered: (payload: ScreeningReorderedEvent) => void;
        onAuditNew: (payload: AuditLogEvent) => void;
        onSecurityEvent: (payload: SecurityEvent) => void;
        onSessionCreated: (payload: SessionCreatedEvent) => void;
        onSessionRevoked: (payload: SessionRevokedEvent) => void;
        onDoctorVerified: (payload: DoctorVerifiedEvent) => void;
    }
): () => void => {
    switch (event) {
        case 'screening:reordered': {
            socketService.on('screening:reordered', handlers.onScreeningReordered);
            return () => socketService.off('screening:reordered', handlers.onScreeningReordered);
        }
        case 'audit:new': {
            socketService.on('audit:new', handlers.onAuditNew);
            return () => socketService.off('audit:new', handlers.onAuditNew);
        }
        case 'security:event': {
            socketService.on('security:event', handlers.onSecurityEvent);
            return () => socketService.off('security:event', handlers.onSecurityEvent);
        }
        case 'session:created': {
            socketService.on('session:created', handlers.onSessionCreated);
            return () => socketService.off('session:created', handlers.onSessionCreated);
        }
        case 'session:revoked': {
            socketService.on('session:revoked', handlers.onSessionRevoked);
            return () => socketService.off('session:revoked', handlers.onSessionRevoked);
        }
        case 'doctor:verified': {
            socketService.on('doctor:verified', handlers.onDoctorVerified);
            return () => socketService.off('doctor:verified', handlers.onDoctorVerified);
        }
        default: {
            const exhaustive: never = event;
            logger.error('[useAdminLiveTable] Unhandled event name', { event: exhaustive });
            return () => { /* no-op for the unknown case */ };
        }
    }
};

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

        // Build a single dispatcher per event-shape. Each handler runs the
        // matching schema's `safeParse` and then forwards to the consumer's
        // generic `onEvent` (or to `refetch()` when no custom handler is
        // supplied). The single targeted cast at the `onEvent` boundary —
        // NOT a double-cast — is required because TS variance cannot prove
        // that a literal payload type is assignable to the consumer's
        // `AdminEventMap[E]` parameter when E is a union; the runtime
        // invariant is that the schema parse just succeeded for this exact
        // event/payload pair.
        const dispatchToConsumer = (event: AdminEventName, validated: AdminEventMap[AdminEventName]): void => {
            if (!isMountedRef.current) return;
            if (onEvent) {
                const next = onEvent(
                    event as E,
                    validated as AdminEventMap[E],
                    itemsRef.current
                );
                if (next === null) {
                    void refetch();
                } else {
                    setItems(next);
                }
            } else {
                void refetch();
            }
        };

        const onScreeningReordered = (payload: ScreeningReorderedEvent): void => {
            const r = ScreeningReorderedEventSchema.safeParse(payload);
            if (!r.success) {
                logger.error('[useAdminLiveTable] screening:reordered payload validation failed', {
                    issues: JSON.stringify(r.error.issues),
                });
                return;
            }
            dispatchToConsumer('screening:reordered', r.data);
        };

        const onAuditNew = (payload: AuditLogEvent): void => {
            const r = AuditLogEventSchema.safeParse(payload);
            if (!r.success) {
                logger.error('[useAdminLiveTable] audit:new payload validation failed', {
                    issues: JSON.stringify(r.error.issues),
                });
                return;
            }
            dispatchToConsumer('audit:new', r.data);
        };

        const onSecurityEvent = (payload: SecurityEvent): void => {
            const r = SecurityEventSchema.safeParse(payload);
            if (!r.success) {
                logger.error('[useAdminLiveTable] security:event payload validation failed', {
                    issues: JSON.stringify(r.error.issues),
                });
                return;
            }
            dispatchToConsumer('security:event', r.data);
        };

        const onSessionCreated = (payload: SessionCreatedEvent): void => {
            const r = SessionCreatedEventSchema.safeParse(payload);
            if (!r.success) {
                logger.error('[useAdminLiveTable] session:created payload validation failed', {
                    issues: JSON.stringify(r.error.issues),
                });
                return;
            }
            dispatchToConsumer('session:created', r.data);
        };

        const onSessionRevoked = (payload: SessionRevokedEvent): void => {
            const r = SessionRevokedEventSchema.safeParse(payload);
            if (!r.success) {
                logger.error('[useAdminLiveTable] session:revoked payload validation failed', {
                    issues: JSON.stringify(r.error.issues),
                });
                return;
            }
            dispatchToConsumer('session:revoked', r.data);
        };

        const onDoctorVerified = (payload: DoctorVerifiedEvent): void => {
            const r = DoctorVerifiedEventSchema.safeParse(payload);
            if (!r.success) {
                logger.error('[useAdminLiveTable] doctor:verified payload validation failed', {
                    issues: JSON.stringify(r.error.issues),
                });
                return;
            }
            dispatchToConsumer('doctor:verified', r.data);
        };

        // Wire up only the requested events. The handlers are constructed
        // once per effect run; their references are stable for the
        // lifetime of the subscription so the cleanup off()s the same
        // function we passed to on().
        const cleanups: Array<() => void> = subscribeEvents.map((event) =>
            subscribeOne(event, {
                onScreeningReordered,
                onAuditNew,
                onSecurityEvent,
                onSessionCreated,
                onSessionRevoked,
                onDoctorVerified,
            })
        );

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

// Re-export the schema map so consumers that need to validate payloads
// outside the hook (e.g. a test harness) have a single import path.
export { AdminEventSchemaMap };
