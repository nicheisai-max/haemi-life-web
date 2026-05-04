import { z } from 'zod';

/**
 * 🛡️ HAEMI LIFE — ADMIN OBSERVABILITY EVENT CONTRACT
 *
 * Single source of truth (backend + frontend) for the typed event vocabulary
 * the backend emits to the `admin:observability` socket room. Each event has
 * a Zod schema (runtime validation against type drift on the wire) and an
 * inferred TypeScript type. The names are deliberately namespaced
 * (`<domain>:<verb>`) so future events slot in without colliding with the
 * existing chat / presence channels.
 *
 * Adding a new event:
 *   1. Define its `<Name>EventSchema` here.
 *   2. Add an entry to `AdminEventName` and `AdminEventMap`.
 *   3. Add a row to `AdminEventSchemaMap` so the runtime validator picks it up.
 *
 * The frontend uses these schemas to validate incoming socket payloads
 * before consuming — defense against backend type drift never crashes a
 * page render. The backend uses them to validate outgoing payloads before
 * emit — guarantees the wire shape always matches the contract.
 *
 * Strict-TS posture (project standard):
 *   - Zero `any`. Zero `as unknown as`. Zero non-null assertions.
 *   - All errors logged via the project logger (not `console.*`).
 */

// ─── Event: Screening question reorder (Phase 1) ─────────────────────────────
//
// Emitted after a successful reorder of the `pre_screening_definitions` table
// rows. The payload is intentionally lean — recipients re-fetch the list to
// pick up the new ordering rather than reconstructing it from the event data
// (avoids drift if multiple admins reorder concurrently).
export const ScreeningReorderedEventSchema = z.object({
    actorId: z.string().uuid(),
    actorRole: z.enum(['admin']),
    questionCount: z.number().int().nonnegative(),
    timestamp: z.string().datetime(),
});
export type ScreeningReorderedEvent = z.infer<typeof ScreeningReorderedEventSchema>;

// ─── Event Name Union ────────────────────────────────────────────────────────
//
// Phase 1 ships a single event so the wiring can be exercised end-to-end with
// minimum surface area. Phases 2-5 extend this union with `audit:new`,
// `session:created`, `session:revoked`, `security:event`, `user:registered`,
// `user:status_changed`, `doctor:pending`, `doctor:verified`.
export const AdminEventNameSchema = z.enum([
    'screening:reordered',
]);
export type AdminEventName = z.infer<typeof AdminEventNameSchema>;

// ─── Event Map (compile-time payload narrowing) ──────────────────────────────
//
// `AdminEventMap[E]` resolves to the exact payload type for event name `E`.
// Used by `emitToAdmins<E>()` (backend) and `useAdminLiveTable<E>()` (frontend)
// so the payload is narrowed without `any` and without manual assertions.
export interface AdminEventMap {
    'screening:reordered': ScreeningReorderedEvent;
}

// ─── Runtime validator lookup ────────────────────────────────────────────────
//
// `AdminEventSchemaMap[E]` returns the Zod schema for event name `E`. Both
// the emitter (before send) and the consumer (after receive) call
// `.parse(payload)` to guarantee wire-shape correctness.
export const AdminEventSchemaMap = {
    'screening:reordered': ScreeningReorderedEventSchema,
} as const satisfies { [E in AdminEventName]: z.ZodType<AdminEventMap[E]> };

// ─── Type guard: is the value an admin event name we know about? ─────────────
//
// Used at frontend subscription boundaries — keeps the cast surface small.
export const isAdminEventName = (value: string): value is AdminEventName => {
    const result = AdminEventNameSchema.safeParse(value);
    return result.success;
};
