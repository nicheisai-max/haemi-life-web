/**
 * clinic-timezone-events.ts
 *
 * 🌍 HAEMI LIFE — CLINIC TIMEZONE BROADCAST CHANNEL
 *
 * Single source of truth for the application-internal event a doctor's
 * clinic timezone change emits. Routes mutations to TWO transports:
 *
 *   1. `window.dispatchEvent` (same-tab, same-window)
 *      Mirrors the established `system:error` / `system:success` /
 *      `system:warning` pattern in `toast-context.tsx` — every
 *      consumer that subscribes via `addEventListener` receives the
 *      payload immediately, no React tree coupling between producer
 *      and consumer.
 *
 *   2. `BroadcastChannel` (cross-tab, same-origin)
 *      A doctor with two browser tabs open — Dashboard in tab A,
 *      Schedule in tab B — saves a new clinic timezone in tab A;
 *      tab B receives the broadcast and syncs its local state
 *      without a refresh. The BroadcastChannel API is supported on
 *      every modern engine (Chrome 54+, Firefox 38+, Safari 15.4+,
 *      Edge 79+). On runtimes that lack it we silently fall back to
 *      same-tab-only behaviour — the user experience degrades to the
 *      prior baseline, never breaks.
 *
 * WHY TWO TRANSPORTS
 *
 *   `window.dispatchEvent` is synchronous and observed by the same
 *   JavaScript realm — perfect for "the modal just saved, the card
 *   below it should rerender now." `BroadcastChannel` is asynchronous
 *   (the browser delivers in the next microtask of the listening tab)
 *   and crosses realm boundaries — required for true multi-tab
 *   consistency. Producers don't pick a transport; both fire from a
 *   single dispatcher call.
 *
 * STRICT-TS POSTURE (project mandate)
 *
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - The `CustomEvent.detail` and `MessageEvent.data` boundaries are
 *     both widened to `unknown` and narrowed via a single structural
 *     type guard — same pattern the `system:*` listeners in
 *     `toast-context.tsx` use.
 *   - All identifiers (event name, channel name, key shape) are
 *     exported constants / interfaces; no hardcoded strings at call
 *     sites.
 */

/**
 * Canonical event name on `window`. Colon-separated namespace mirrors
 * the `system:*` family already in use. Exported so listeners and
 * dispatchers reference the same constant — a typo here is a compile
 * error rather than a silent miss.
 */
export const CLINIC_TIMEZONE_UPDATED_EVENT = 'clinic-timezone:updated' as const;

/**
 * Canonical BroadcastChannel name. Same-origin tabs subscribe to the
 * same channel; the browser handles delivery routing.
 */
export const CLINIC_TIMEZONE_BROADCAST_CHANNEL = 'haemi-clinic-timezone' as const;

/**
 * Wire shape carried on both `CustomEvent.detail` and
 * `BroadcastChannel.postMessage`. The server-echoed `clinicTimezone`
 * is the IANA identifier (e.g. `Asia/Kolkata`). Kept intentionally
 * minimal — adding fields requires a deliberate shape change and
 * updates to both dispatcher and parser, which is the desired
 * friction.
 */
export interface ClinicTimezoneUpdatedDetail {
    readonly clinicTimezone: string;
}

/**
 * Lazily-created singleton channel. Reused across every dispatch so
 * we don't churn channel handles. `null` when the runtime doesn't
 * implement the API (older Safari, locked-down WebViews).
 */
let cachedBroadcastChannel: BroadcastChannel | null = null;
let broadcastChannelProbed: boolean = false;

const getBroadcastChannel = (): BroadcastChannel | null => {
    if (broadcastChannelProbed) return cachedBroadcastChannel;
    broadcastChannelProbed = true;
    if (typeof BroadcastChannel === 'undefined') return null;
    try {
        cachedBroadcastChannel = new BroadcastChannel(CLINIC_TIMEZONE_BROADCAST_CHANNEL);
    } catch {
        cachedBroadcastChannel = null;
    }
    return cachedBroadcastChannel;
};

/**
 * Broadcast a clinic-timezone update to every listener on this tab
 * (via `window.dispatchEvent`) AND every other same-origin tab (via
 * `BroadcastChannel`). Idempotent at the consumer level — if
 * `clinicTimezone` equals what a listener already has, the listener's
 * setState is a no-op courtesy of React's referential equality
 * bail-out.
 *
 * Producers should call this AFTER the backend has confirmed the
 * write (i.e. after `updateClinicTimezone()` resolves) so the
 * broadcast only fires when the canonical state has actually changed.
 */
export const dispatchClinicTimezoneUpdated = (clinicTimezone: string): void => {
    const detail: ClinicTimezoneUpdatedDetail = { clinicTimezone };

    // Same-tab dispatch — synchronous, observable in the next render.
    window.dispatchEvent(
        new CustomEvent<ClinicTimezoneUpdatedDetail>(CLINIC_TIMEZONE_UPDATED_EVENT, { detail })
    );

    // Cross-tab dispatch — async, observable by every other tab on
    // this origin that has installed a listener. Fails silently on
    // runtimes without BroadcastChannel; the same-tab path above is
    // unaffected.
    const channel = getBroadcastChannel();
    if (channel !== null) {
        try {
            channel.postMessage(detail);
        } catch {
            // postMessage may throw on payloads with non-structured-
            // cloneable values, but our payload is plain string fields.
            // Defensive catch keeps the producer flow alive if a future
            // payload extension violates that contract.
        }
    }
};

/**
 * Structurally narrow an incoming `Event` (from `window` listener)
 * into a typed `ClinicTimezoneUpdatedDetail`. Returns `null` for any
 * payload that fails the shape check — callers handle the `null` case
 * explicitly (typically a silent ignore + `logger.warn`).
 */
export const parseClinicTimezoneUpdatedEvent = (e: Event): ClinicTimezoneUpdatedDetail | null => {
    const raw: unknown = (e as CustomEvent<unknown>).detail;
    return narrowDetail(raw);
};

/**
 * Structurally narrow an incoming `MessageEvent` (from
 * `BroadcastChannel` listener) into a typed
 * `ClinicTimezoneUpdatedDetail`. Same narrowing logic as
 * `parseClinicTimezoneUpdatedEvent` — both transports carry the same
 * payload shape, so the guard is shared.
 */
export const parseClinicTimezoneBroadcastMessage = (
    e: MessageEvent<unknown>
): ClinicTimezoneUpdatedDetail | null => {
    return narrowDetail(e.data);
};

/**
 * Subscribe to BOTH transports with a single call. Returns a
 * teardown function that cleans up both subscriptions. Consumers in
 * React `useEffect` blocks should return this from their effect.
 *
 * The handler receives the already-narrowed payload — null cases are
 * filtered out and logged-via-callback if the consumer wants to
 * observe them (typically: silent ignore).
 */
export const subscribeToClinicTimezoneUpdates = (
    handler: (detail: ClinicTimezoneUpdatedDetail) => void,
    onMalformed?: () => void,
): (() => void) => {
    const windowListener: EventListener = (e) => {
        const detail = parseClinicTimezoneUpdatedEvent(e);
        if (detail === null) {
            onMalformed?.();
            return;
        }
        handler(detail);
    };
    window.addEventListener(CLINIC_TIMEZONE_UPDATED_EVENT, windowListener);

    const channel = getBroadcastChannel();
    let channelListener: ((e: MessageEvent<unknown>) => void) | null = null;
    if (channel !== null) {
        channelListener = (e: MessageEvent<unknown>) => {
            const detail = parseClinicTimezoneBroadcastMessage(e);
            if (detail === null) {
                onMalformed?.();
                return;
            }
            handler(detail);
        };
        channel.addEventListener('message', channelListener);
    }

    return () => {
        window.removeEventListener(CLINIC_TIMEZONE_UPDATED_EVENT, windowListener);
        if (channel !== null && channelListener !== null) {
            channel.removeEventListener('message', channelListener);
        }
    };
};

const narrowDetail = (raw: unknown): ClinicTimezoneUpdatedDetail | null => {
    // TypeScript 5.x narrows `'x' in obj` to add `x: unknown` to
    // `obj`'s inferred type once `obj` is itself narrowed to a non-
    // null object. The follow-up `typeof` check then narrows
    // `raw.clinicTimezone` to `string` — no structural cast needed,
    // tighter than the codebase's older `toast-context.tsx` pattern.
    if (
        typeof raw === 'object'
        && raw !== null
        && 'clinicTimezone' in raw
        && typeof raw.clinicTimezone === 'string'
        && raw.clinicTimezone.length > 0
    ) {
        return { clinicTimezone: raw.clinicTimezone };
    }
    return null;
};
