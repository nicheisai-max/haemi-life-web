import { ZodError } from 'zod';
import { socketIO } from '../app';
import { logger } from '../utils/logger';
import {
    AdminEventName,
    AdminEventMap,
    AdminEventSchemaMap,
} from '../../../shared/schemas/admin-events.schema';

/**
 * Per-event emit dispatch table. Each entry uses the *literal* event-name
 * string in the inner `socketIO.to(...).emit(...)` call so TypeScript
 * resolves the typed emit signature precisely against `ServerToClientEvents`
 * — no generic-variance issues, no casts, zero `as unknown as`. Adding a
 * new admin event is one new row here plus one row in
 * `shared/schemas/admin-events.schema.ts`. The `satisfies` clause makes
 * TypeScript verify that this table is exhaustive against `AdminEventName`
 * — a missing entry is a compile error, not a runtime gap.
 */
type AdminEmitDispatch = {
    [E in AdminEventName]: (payload: AdminEventMap[E]) => void;
};

/**
 * 🛡️ HAEMI LIFE — ADMIN BROADCAST SERVICE
 *
 * Single chokepoint for emitting typed events to the `admin:observability`
 * socket room. Every emit goes through this module so that:
 *
 *   1. The wire payload is *validated against the Zod schema* before send.
 *      A type drift between the emitter call site and the contract is
 *      caught at runtime and logged — never silently shipped to admins.
 *
 *   2. The room name is centralised — no controller writes the literal
 *      'admin:observability' string. Future scope changes (per-domain
 *      sub-rooms, per-tenant rooms) flip exactly one location.
 *
 *   3. Errors flow through `logger` only (project mandate). Emit failures
 *      do NOT throw — they degrade gracefully so a controller's primary
 *      action never fails because the observability hop did. Admins
 *      simply miss one live event; the underlying DB write that
 *      triggered the emit is unaffected.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`, zero `as unknown as`, zero `@ts-ignore`.
 *   - The payload type is narrowed by the generic `E extends AdminEventName`
 *     so each call site auto-completes the correct shape.
 *   - The `unknown` returned by `safeParse` is narrowed by the result's
 *     `success` discriminant — no manual cast needed.
 */

const ADMIN_OBSERVABILITY_ROOM = 'admin:observability' as const;

/**
 * Per-event emit dispatch table. Each entry uses a *literal* event-name
 * string at the inner `socketIO.to(...).emit(...)` call so TypeScript can
 * resolve the typed emit signature precisely against `ServerToClientEvents`
 * — no generic-variance issues, no casts, zero `as unknown as`.
 *
 * Adding a new admin event:
 *   1. Add its name + payload type in `shared/schemas/admin-events.schema.ts`.
 *   2. Add a new entry below.
 * The `satisfies AdminEmitDispatch` clause makes TypeScript verify the
 * table is exhaustive — a missing entry is a compile error.
 */
const ADMIN_EMIT_DISPATCH = {
    'screening:reordered': (payload) => {
        if (!socketIO) return;
        socketIO.to(ADMIN_OBSERVABILITY_ROOM).emit('screening:reordered', payload);
    },
} as const satisfies AdminEmitDispatch;

/**
 * Emit a typed event to every admin currently joined to the observability
 * room. Returns `true` if the emit was accepted by the socket layer.
 *
 * Validation failures are logged and the emit is *skipped* (returns `false`).
 * Callers should NOT branch on the return value for primary application
 * flow — this function is best-effort observability, not a transactional
 * guarantee.
 */
export function emitToAdmins<E extends AdminEventName>(
    event: E,
    payload: AdminEventMap[E]
): boolean {
    if (!socketIO) {
        // Socket server not yet initialised. This is expected during early
        // boot or in test environments where sockets are not wired. Log at
        // `info` (not `error`) since this is a known degraded state, not a
        // fault.
        logger.info('[AdminBroadcast] Skipped emit — socket server not ready', {
            event,
        });
        return false;
    }

    const schema = AdminEventSchemaMap[event];
    const validation = schema.safeParse(payload);

    if (!validation.success) {
        // Schema mismatch — the payload shape diverged from the contract.
        // Log the Zod issues for diagnosis but DO NOT throw: the caller's
        // primary action (e.g. a successful screening reorder) has already
        // happened and must not be reverted by an observability bug.
        const issues: string =
            validation.error instanceof ZodError
                ? JSON.stringify(validation.error.issues)
                : 'unknown';
        logger.error('[AdminBroadcast] Payload validation failed; emit skipped', {
            event,
            issues,
        });
        return false;
    }

    try {
        // Per-event dispatch — resolves through the literal-keyed table
        // so the inner emit call sees a precise event-name + payload pair
        // and TypeScript validates against `ServerToClientEvents` without
        // generic-variance casts.
        const dispatcher = ADMIN_EMIT_DISPATCH[event];
        dispatcher(validation.data);
        return true;
    } catch (error: unknown) {
        const message: string =
            error instanceof Error ? error.message : String(error);
        logger.error('[AdminBroadcast] Socket emit threw', {
            event,
            error: message,
        });
        return false;
    }
}
