import { useEffect, useMemo, useState } from 'react';

/**
 * 🛡️ HAEMI LIFE — useRelativeTime
 *
 * Renders a timestamp as a live "X seconds ago" / "X minutes ago" string
 * that auto-updates as the wall clock advances. One global ticker drives
 * every consumer, so a page with N rows pays the cost of one interval —
 * not N — even at 100+ live sessions.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - The input is `string | Date | null | undefined`; null / undefined
 *     yield the configured fallback ("Never" by default) without throwing.
 *   - Invalid date strings (e.g. "" or malformed ISO) detected via
 *     `Number.isNaN(parsed.getTime())` — no `console.*` for the failure
 *     case; the fallback string is returned silently. The intent is for
 *     this hook to be safe to drop into any cell renderer.
 *
 * Granularity:
 *   - 'second' (default): updates every second; suitable for live
 *     session activity displays where freshness matters.
 *   - 'minute': updates every 30 seconds; suitable for less-active
 *     surfaces (audit logs already have own "Live" indicator).
 */

const SECOND_TICK_MS = 1_000;
const MINUTE_TICK_MS = 30_000;

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

type Granularity = 'second' | 'minute';

// ─── Module-level ticker (one timer for the whole app) ───────────────────────
//
// Each granularity has its own subscriber set + interval. The interval
// only runs while at least one consumer is mounted; the last unsubscriber
// clears it. Avoids a per-component setInterval (which would multiply
// timer cost by row count on a list page).

type TickerState = {
    timer: ReturnType<typeof setInterval> | null;
    subscribers: Set<() => void>;
};

const tickers: Record<Granularity, TickerState> = {
    second: { timer: null, subscribers: new Set() },
    minute: { timer: null, subscribers: new Set() },
};

const subscribeToTicker = (granularity: Granularity, listener: () => void): (() => void) => {
    const state = tickers[granularity];
    state.subscribers.add(listener);
    if (state.timer === null) {
        const interval = granularity === 'second' ? SECOND_TICK_MS : MINUTE_TICK_MS;
        state.timer = setInterval(() => {
            for (const subscriber of state.subscribers) subscriber();
        }, interval);
    }
    return () => {
        state.subscribers.delete(listener);
        if (state.subscribers.size === 0 && state.timer !== null) {
            clearInterval(state.timer);
            state.timer = null;
        }
    };
};

// ─── Format helpers ──────────────────────────────────────────────────────────

const formatRelative = (deltaMs: number): string => {
    if (deltaMs < 0) {
        // Future timestamp — clock skew or scheduled event. Render
        // symmetrically as "in N units".
        return formatFuture(-deltaMs);
    }
    if (deltaMs < 5 * SECOND) return 'just now';
    if (deltaMs < MINUTE) return `${Math.floor(deltaMs / SECOND)}s ago`;
    if (deltaMs < HOUR) return `${Math.floor(deltaMs / MINUTE)}m ago`;
    if (deltaMs < DAY) return `${Math.floor(deltaMs / HOUR)}h ago`;
    if (deltaMs < WEEK) return `${Math.floor(deltaMs / DAY)}d ago`;
    return `${Math.floor(deltaMs / WEEK)}w ago`;
};

const formatFuture = (deltaMs: number): string => {
    if (deltaMs < MINUTE) return `in ${Math.floor(deltaMs / SECOND)}s`;
    if (deltaMs < HOUR) return `in ${Math.floor(deltaMs / MINUTE)}m`;
    if (deltaMs < DAY) return `in ${Math.floor(deltaMs / HOUR)}h`;
    return `in ${Math.floor(deltaMs / DAY)}d`;
};

// ─── Public hook ─────────────────────────────────────────────────────────────

export interface UseRelativeTimeOptions {
    readonly granularity?: Granularity;
    /** String shown when the input is `null` / `undefined` / unparseable. */
    readonly fallback?: string;
}

export const useRelativeTime = (
    timestamp: string | Date | null | undefined,
    options: UseRelativeTimeOptions = {}
): string => {
    const granularity: Granularity = options.granularity ?? 'second';
    const fallback: string = options.fallback ?? 'Never';

    // Parse once per `timestamp` change. The result is `Date | null` —
    // null when the input is missing or unparseable, so the renderer
    // always knows it is dealing with a valid Date.
    const parsedDate: Date | null = useMemo(() => {
        if (timestamp === null || timestamp === undefined) return null;
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        if (Number.isNaN(date.getTime())) return null;
        return date;
    }, [timestamp]);

    // Wall-clock "now" is held in state so the render path is pure —
    // calling `Date.now()` directly during render violates React's
    // components-must-be-idempotent rule. The ticker subscription
    // updates this value on every interval beat; the render then
    // computes the delta with state values only.
    const [now, setNow] = useState<number>(() => Date.now());

    useEffect(() => {
        if (parsedDate === null) return; // no need to subscribe if we have nothing to render
        // The first render uses the `Date.now()` captured by the
        // `useState` initialiser (called once at mount). The ticker
        // catches up on the next beat (≤ 1 s for `second` granularity,
        // ≤ 30 s for `minute`). We deliberately do NOT call `setNow`
        // synchronously inside this effect — that would trigger a
        // cascading render and trip the `react-hooks/set-state-in-effect`
        // lint rule. The brief one-tick staleness on a freshly-changed
        // timestamp is acceptable for a relative-time display.
        const unsubscribe = subscribeToTicker(granularity, () => {
            setNow(Date.now());
        });
        return unsubscribe;
    }, [granularity, parsedDate]);

    if (parsedDate === null) return fallback;
    const deltaMs = now - parsedDate.getTime();
    return formatRelative(deltaMs);
};
