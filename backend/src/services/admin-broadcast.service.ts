import { ZodError } from 'zod';
import { socketIO } from '../app';
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
} from '../../../shared/schemas/admin-events.schema';

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
 *   - Caller-side narrowing is achieved via a *discriminated argument*
 *     shape (`AdminEmitArgs`) rather than a generic `(event, payload)`
 *     pair. TypeScript narrows `args.payload` correctly through the
 *     `args.event` discriminator inside each `case` of the implementation
 *     switch — zero casts at the emit site.
 */

const ADMIN_OBSERVABILITY_ROOM = 'admin:observability' as const;

/**
 * Discriminated-union argument shape for the public `emitToAdmins`
 * chokepoint. Adding a new event = add one branch here, one branch in
 * `shared/schemas/admin-events.schema.ts`, and one case in the
 * implementation `switch` below. The `never` exhaustiveness check at the
 * default branch makes a missing case a compile error, never a runtime gap.
 */
export type AdminEmitArgs =
    | { readonly event: 'screening:reordered'; readonly payload: AdminEventMap['screening:reordered'] }
    | { readonly event: 'audit:new'; readonly payload: AdminEventMap['audit:new'] }
    | { readonly event: 'security:event'; readonly payload: AdminEventMap['security:event'] }
    | { readonly event: 'session:created'; readonly payload: AdminEventMap['session:created'] }
    | { readonly event: 'session:revoked'; readonly payload: AdminEventMap['session:revoked'] }
    | { readonly event: 'doctor:verified'; readonly payload: AdminEventMap['doctor:verified'] };

/**
 * Format a Zod validation error as a compact JSON string for the audit log.
 * Centralised so each emit branch is identical.
 */
const formatZodIssues = (error: ZodError): string => JSON.stringify(error.issues);

/**
 * Emit a typed event to every admin currently joined to the observability
 * room. Returns `true` if the emit was accepted by the socket layer.
 *
 * Validation failures are logged and the emit is *skipped* (returns `false`).
 * Callers should NOT branch on the return value for primary application
 * flow — this function is best-effort observability, not a transactional
 * guarantee.
 */
export function emitToAdmins(args: AdminEmitArgs): boolean {
    if (!socketIO) {
        // Socket server not yet initialised. This is expected during early
        // boot or in test environments where sockets are not wired. Log at
        // `info` (not `error`) since this is a known degraded state, not
        // a fault.
        logger.info('[AdminBroadcast] Skipped emit — socket server not ready', {
            event: args.event,
        });
        return false;
    }

    try {
        // Per-event branch: each case validates with the literal-named
        // schema and emits with the literal-named event. TypeScript narrows
        // `args.payload` via the `args.event` discriminator so every emit
        // call is precisely typed against `ServerToClientEvents` — zero
        // casts, zero generic-variance issues. The Zod parse is
        // defense-in-depth: drifted payloads are logged and dropped, never
        // shipped over the wire.
        switch (args.event) {
            case 'screening:reordered': {
                const result = ScreeningReorderedEventSchema.safeParse(args.payload);
                if (!result.success) {
                    logger.error('[AdminBroadcast] Payload validation failed; emit skipped', {
                        event: args.event,
                        issues: formatZodIssues(result.error),
                    });
                    return false;
                }
                socketIO.to(ADMIN_OBSERVABILITY_ROOM).emit('screening:reordered', result.data);
                return true;
            }
            case 'audit:new': {
                const result = AuditLogEventSchema.safeParse(args.payload);
                if (!result.success) {
                    logger.error('[AdminBroadcast] Payload validation failed; emit skipped', {
                        event: args.event,
                        issues: formatZodIssues(result.error),
                    });
                    return false;
                }
                socketIO.to(ADMIN_OBSERVABILITY_ROOM).emit('audit:new', result.data);
                return true;
            }
            case 'security:event': {
                const result = SecurityEventSchema.safeParse(args.payload);
                if (!result.success) {
                    logger.error('[AdminBroadcast] Payload validation failed; emit skipped', {
                        event: args.event,
                        issues: formatZodIssues(result.error),
                    });
                    return false;
                }
                socketIO.to(ADMIN_OBSERVABILITY_ROOM).emit('security:event', result.data);
                return true;
            }
            case 'session:created': {
                const result = SessionCreatedEventSchema.safeParse(args.payload);
                if (!result.success) {
                    logger.error('[AdminBroadcast] Payload validation failed; emit skipped', {
                        event: args.event,
                        issues: formatZodIssues(result.error),
                    });
                    return false;
                }
                socketIO.to(ADMIN_OBSERVABILITY_ROOM).emit('session:created', result.data);
                return true;
            }
            case 'session:revoked': {
                const result = SessionRevokedEventSchema.safeParse(args.payload);
                if (!result.success) {
                    logger.error('[AdminBroadcast] Payload validation failed; emit skipped', {
                        event: args.event,
                        issues: formatZodIssues(result.error),
                    });
                    return false;
                }
                socketIO.to(ADMIN_OBSERVABILITY_ROOM).emit('session:revoked', result.data);
                return true;
            }
            case 'doctor:verified': {
                const result = DoctorVerifiedEventSchema.safeParse(args.payload);
                if (!result.success) {
                    logger.error('[AdminBroadcast] Payload validation failed; emit skipped', {
                        event: args.event,
                        issues: formatZodIssues(result.error),
                    });
                    return false;
                }
                socketIO.to(ADMIN_OBSERVABILITY_ROOM).emit('doctor:verified', result.data);
                return true;
            }
            default: {
                // Exhaustiveness check — adding an event without a case
                // here surfaces as a compile error instead of a runtime
                // silent skip. The `never` assignment is the canonical TS
                // pattern for this guarantee.
                const exhaustive: never = args;
                logger.error('[AdminBroadcast] Unhandled event name', {
                    args: JSON.stringify(exhaustive),
                });
                return false;
            }
        }
    } catch (error: unknown) {
        const message: string =
            error instanceof Error ? error.message : String(error);
        logger.error('[AdminBroadcast] Socket emit threw', {
            event: args.event,
            error: message,
        });
        return false;
    }
}

/**
 * Re-exported for callers that need to enumerate the valid event names
 * (e.g. a future admin-side feature flag). Saves the import line for the
 * common case.
 */
export { AdminEventSchemaMap };
export type { AdminEventName, AdminEventMap };
