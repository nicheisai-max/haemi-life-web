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

// ─── Event: Audit log row written (Phase 2) ──────────────────────────────────
//
// Emitted *after* a successful INSERT into `audit_logs`. Payload is the full
// row plus the actor's display fields (joined from `users`) so admin pages
// can render without an immediate refetch. Nullables match the SQL nullability
// honestly: `userId` is non-null (Zero-Trust policy enforces a sentinel
// `00000000-...` for system actions), but the joined display fields can be
// null when the actor row no longer exists. `details` is the raw JSONB —
// consumers parse / expand it client-side.
export const AuditLogEventSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    action: z.string().min(1),
    entityType: z.string().nullable(),
    entityId: z.string().nullable(),
    /**
     * The DB column is `JSONB`; over the wire the value can be a structured
     * object/array, a JSON string (legacy writes), or `null`. We accept any
     * of those shapes here and let the consumer decide how to render —
     * coercing to a strict shape would make us responsible for keeping every
     * existing audit-writer in lock-step.
     */
    details: z.union([z.record(z.string(), z.unknown()), z.string(), z.null()]),
    ipAddress: z.string().nullable(),
    userAgent: z.string().nullable(),
    createdAt: z.string().datetime(),
    userName: z.string().nullable(),
    userEmail: z.string().nullable(),
    userRole: z.string().nullable(),
});
export type AuditLogEvent = z.infer<typeof AuditLogEventSchema>;

// ─── Event: Security event observed (Phase 2) ────────────────────────────────
//
// Currently the security-events surface is *derived* from `audit_logs` rows
// matching `%SECURITY%`, `%LOGIN%`, or `%REVOKE%` (see
// `securityRepository.getSecurityEvents`). The emit follows the same rule —
// the same audit row that triggers `audit:new` ALSO triggers `security:event`
// when the action matches the security pattern. This means the same DB row
// flows through two channels, which is intentional: admins viewing the
// Security page should see the event even if they have never opened the
// Audit Logs page.
export const SecurityEventSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid().nullable(),
    eventType: z.string().min(1),
    eventCategory: z.string().nullable(),
    eventSeverity: z.string().nullable(),
    ipAddress: z.string().nullable(),
    userAgent: z.string().nullable(),
    isSuspicious: z.boolean(),
    createdAt: z.string().datetime(),
    userName: z.string().nullable(),
    userEmail: z.string().nullable(),
    userRole: z.string().nullable(),
});
export type SecurityEvent = z.infer<typeof SecurityEventSchema>;

// ─── Event: Session created (Phase 3) ────────────────────────────────────────
//
// Emitted on every successful signup or login — exactly when a row is
// inserted into `user_sessions`. Payload shape mirrors the columns the
// admin Sessions page already renders, plus the device-parse fields
// (`browserName`, `osName`, `deviceType`) which the backend stores at
// session creation time and which Phase 3 surfaces in the UI.
export const SessionCreatedEventSchema = z.object({
    id: z.string().uuid(),
    sessionId: z.string(),
    userId: z.string().uuid(),
    userRole: z.string(),
    userName: z.string().nullable(),
    userEmail: z.string().nullable(),
    profileImage: z.string().nullable(),
    ipAddress: z.string().nullable(),
    userAgent: z.string().nullable(),
    browserName: z.string().nullable(),
    osName: z.string().nullable(),
    deviceType: z.string().nullable(),
    createdAt: z.string().datetime(),
    lastActivity: z.string().datetime().nullable(),
});
export type SessionCreatedEvent = z.infer<typeof SessionCreatedEventSchema>;

// ─── Event: Session revoked (Phase 3) ────────────────────────────────────────
//
// Emitted on successful revocation — admin-initiated via the Sessions
// page or self-initiated via logout. The payload is intentionally lean:
// `id`/`sessionId` so consumers can locate and remove the row, plus a
// `reason` for diagnostic logging. Consumers re-fetch if they need
// authoritative state.
export const SessionRevokedEventSchema = z.object({
    id: z.string().uuid(),
    sessionId: z.string(),
    userId: z.string().uuid().nullable(),
    reason: z.string().nullable(),
    revokedAt: z.string().datetime(),
});
export type SessionRevokedEvent = z.infer<typeof SessionRevokedEventSchema>;

// ─── Event: Doctor verified (Phase 3) ────────────────────────────────────────
//
// Emitted when an admin approves or rejects a pending doctor — both
// outcomes flow through the same channel because the admin Verify
// Doctors page treats them identically (the verified/rejected doctor
// disappears from the pending queue either way). The `outcome` field
// carries the discriminator so consumers can render the appropriate
// toast text without an extra fetch.
export const DoctorVerifiedEventSchema = z.object({
    profileId: z.string(),
    userId: z.string().uuid(),
    outcome: z.enum(['approved', 'rejected']),
    verifiedBy: z.string().uuid(),
    timestamp: z.string().datetime(),
});
export type DoctorVerifiedEvent = z.infer<typeof DoctorVerifiedEventSchema>;

// ─── Event: User registered (Phase 4) ────────────────────────────────────────
//
// Emitted on every successful signup — exactly when a new row is
// inserted into `users`. Payload mirrors the columns the admin User
// Management table renders, plus role / status so the row can be
// rendered immediately without a follow-up fetch. `lastActivity` is
// always `null` at registration time but included for shape parity
// with `user:status_changed` so frontend code paths stay symmetric.
export const UserRegisteredEventSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().nullable(),
    phoneNumber: z.string().nullable(),
    role: z.string(),
    status: z.string(),
    initials: z.string().nullable(),
    profileImage: z.string().nullable(),
    createdAt: z.string().datetime(),
    lastActivity: z.string().datetime().nullable(),
});
export type UserRegisteredEvent = z.infer<typeof UserRegisteredEventSchema>;

// ─── Event: User status changed (Phase 4) ────────────────────────────────────
//
// Emitted when an admin activates / deactivates / suspends a user via
// the User Management page. Payload carries enough information for the
// admin UI to update the row in-place (`status`, `name` for the toast)
// AND a `previousStatus` discriminator so the audit/visual cue can
// differentiate "Activated" from "Deactivated" without a server lookup.
export const UserStatusChangedEventSchema = z.object({
    userId: z.string().uuid(),
    name: z.string(),
    email: z.string().nullable(),
    role: z.string(),
    previousStatus: z.string(),
    newStatus: z.string(),
    changedBy: z.string().uuid(),
    timestamp: z.string().datetime(),
});
export type UserStatusChangedEvent = z.infer<typeof UserStatusChangedEventSchema>;

// ─── Event: Appointment overdue (post-Phase-5) ───────────────────────────────
//
// Emitted by the backend's overdue-monitor cron when a scheduled
// appointment has passed `appointment_time + 15 minutes` without the
// doctor marking it complete or no-show. Drives the doctor's UI to
// flip the row's tint to amber and surface both "Mark Complete" and
// "Mark No-Show" buttons (instead of just "Mark Complete"), and
// triggers a non-blocking warning toast on the doctor's currently
// open browser tab.
//
// Crucially, this event does NOT change the appointment's status —
// the doctor decides whether the patient ultimately attended (Mark
// Complete) or not (Mark No-Show). Auto-flipping status would be a
// liability transfer and is explicitly rejected by the design.
//
// `minutesLate` is computed at emit time (cron tick - appointment
// instant, in minutes) so the consumer can render
// "Awaiting patient · 15m late" without recomputing on the client.
export const AppointmentOverdueEventSchema = z.object({
    appointmentId: z.number().int().positive(),
    doctorId: z.string().uuid(),
    patientId: z.string().uuid(),
    patientName: z.string().nullable(),
    appointmentDate: z.string(),
    appointmentTime: z.string(),
    minutesLate: z.number().int().nonnegative(),
    timestamp: z.string().datetime(),
});
export type AppointmentOverdueEvent = z.infer<typeof AppointmentOverdueEventSchema>;

// ─── Event Name Union ────────────────────────────────────────────────────────
//
// Phase 4 extended the union with `user:registered` /
// `user:status_changed`. Phase 5 added system-health polling (no event
// — the dashboard polls). Post-Phase-5 adds `appointment:overdue` for
// the doctor-side appointment-lifecycle UX.
export const AdminEventNameSchema = z.enum([
    'screening:reordered',
    'audit:new',
    'security:event',
    'session:created',
    'session:revoked',
    'doctor:verified',
    'user:registered',
    'user:status_changed',
    'appointment:overdue',
]);
export type AdminEventName = z.infer<typeof AdminEventNameSchema>;

// ─── Event Map (compile-time payload narrowing) ──────────────────────────────
//
// `AdminEventMap[E]` resolves to the exact payload type for event name `E`.
// Used by `emitToAdmins<E>()` (backend) and `useAdminLiveTable<E>()` (frontend)
// so the payload is narrowed without `any` and without manual assertions.
export interface AdminEventMap {
    'screening:reordered': ScreeningReorderedEvent;
    'audit:new': AuditLogEvent;
    'security:event': SecurityEvent;
    'session:created': SessionCreatedEvent;
    'session:revoked': SessionRevokedEvent;
    'doctor:verified': DoctorVerifiedEvent;
    'user:registered': UserRegisteredEvent;
    'user:status_changed': UserStatusChangedEvent;
    'appointment:overdue': AppointmentOverdueEvent;
}

// ─── Runtime validator lookup ────────────────────────────────────────────────
//
// `AdminEventSchemaMap[E]` returns the Zod schema for event name `E`. Both
// the emitter (before send) and the consumer (after receive) call
// `.parse(payload)` to guarantee wire-shape correctness. The `satisfies`
// clause makes TypeScript prove that every event name has a matching
// validator — adding an event to the union without a schema is a compile
// error, never a runtime gap.
export const AdminEventSchemaMap = {
    'screening:reordered': ScreeningReorderedEventSchema,
    'audit:new': AuditLogEventSchema,
    'security:event': SecurityEventSchema,
    'session:created': SessionCreatedEventSchema,
    'session:revoked': SessionRevokedEventSchema,
    'doctor:verified': DoctorVerifiedEventSchema,
    'user:registered': UserRegisteredEventSchema,
    'user:status_changed': UserStatusChangedEventSchema,
    'appointment:overdue': AppointmentOverdueEventSchema,
} as const satisfies { [E in AdminEventName]: z.ZodType<AdminEventMap[E]> };

// ─── Type guard: is the value an admin event name we know about? ─────────────
//
// Used at frontend subscription boundaries — keeps the cast surface small.
export const isAdminEventName = (value: string): value is AdminEventName => {
    const result = AdminEventNameSchema.safeParse(value);
    return result.success;
};

// ─── Security-event suspicion classifier ─────────────────────────────────────
//
// Frontend-side classifier that decides whether a `SecurityEvent` should be
// treated as suspicious for threat-level computation. Lives in shared/
// because the backend may want to apply the same rule when persisting
// `security_events.is_suspicious` in a future phase. Single source of truth.
//
// Patterns deliberately use word-boundary anchors and `i` flag so that
// `LOGIN_FAILURE`, `LOGIN_FAILED`, and `FAILED_LOGIN` all match without
// false positives on `LOGIN_SUCCESS` / `LOGIN_REFRESH`.
const SUSPICIOUS_EVENT_PATTERNS: ReadonlyArray<RegExp> = [
    /\bLOGIN[_ ]?FAIL/i,
    /\bFAILED[_ ]?LOGIN/i,
    /\bFORBIDDEN/i,
    /\bUNAUTHORIZED/i,
    /\bREVOKE/i,
    /\bINTRUSION/i,
    /\bBREACH/i,
];

export const isSuspiciousSecurityEvent = (event: Pick<SecurityEvent, 'eventType' | 'isSuspicious'>): boolean => {
    if (event.isSuspicious) return true;
    return SUSPICIOUS_EVENT_PATTERNS.some((pattern) => pattern.test(event.eventType));
};
