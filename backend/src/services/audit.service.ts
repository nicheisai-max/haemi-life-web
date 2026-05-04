import { pool } from '../config/db';
import { logger } from '../utils/logger';
import { emitToAdmins } from './admin-broadcast.service';
import { isSuspiciousSecurityEvent } from '../../../shared/schemas/admin-events.schema';

// CANONICAL ANONYMOUS IDENTITY (Zero-Trust Compliant)
export const SYSTEM_ANONYMOUS_ID = '00000000-0000-0000-0000-000000000000';

export interface AuditLogEntry {
    userId: string; // Mandatory per Zero-Trust Identity Policy
    actorRole?: string;

    // Canonical Audit Identifiers (Google-Grade Standard)
    action: string;
    entityId?: string | null;
    entityType?: string;

    location?: string;
    details?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    accessTokenJti?: string;
    refreshTokenJti?: string;
    deviceType?: string;
}

/**
 * Row shape returned by the `RETURNING` clause of the audit insert plus the
 * actor's display fields fetched via a follow-up `users` lookup. Captured
 * here so the type is shared between the insert path and the broadcast
 * payload without `any`. `details` arrives as `unknown` because the column
 * is `JSONB` — the `pg` driver auto-deserialises it to a structured value
 * which we forward unchanged to admin consumers.
 */
interface AuditLogInsertedRow {
    id: string;
    user_id: string;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    details: unknown;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Date;
}

interface ActorJoinRow {
    name: string | null;
    email: string | null;
    role: string | null;
}

/**
 * Pre-compiled patterns identifying which audit actions should ALSO be
 * mirrored to the `security:event` admin channel. The list mirrors the
 * SQL filter in `securityRepository.getSecurityEvents` so the live
 * stream and the historic query agree on what counts as a security event.
 */
const SECURITY_EVENT_PATTERNS: ReadonlyArray<RegExp> = [
    /SECURITY/i,
    /LOGIN/i,
    /REVOKE/i,
    /FORBIDDEN/i,
    /UNAUTHORIZED/i,
];

const matchesSecurityPattern = (action: string): boolean =>
    SECURITY_EVENT_PATTERNS.some((pattern) => pattern.test(action));

/**
 * Resolve the JSONB column shape returned by the `pg` driver into the wire
 * shape expected by `AuditLogEvent`. The driver may hand back: (a) a
 * structured value (object / array / scalar) when the column was inserted
 * as native JSONB, (b) a JSON-encoded string when an older writer stored a
 * stringified object, or (c) `null`. The wire schema accepts all three but
 * only structured records can be safely typed as `Record<string, unknown>`
 * — anything else is forwarded as `null` to keep the consumer contract
 * narrow.
 */
const normaliseDetailsForWire = (raw: unknown): Record<string, unknown> | string | null => {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && !Array.isArray(raw)) {
        return raw as Record<string, unknown>;
    }
    return null;
};

export const auditService = {
    log: async (entry: AuditLogEntry) => {
        try {
            // ZERO-TRUST CANONICAL IDENTITY ENFORCEMENT
            if (!entry.userId) {
                throw new Error("Identity policy violation: userId required");
            }

            const userId = entry.userId;

            // 🩺 HAEMI CANONICAL RESOLUTION (Strict Alignment)
            const action = entry.action || 'UNKNOWN_ACTION';
            const entityId = entry.entityId || null;
            const entityType = entry.entityType || 'UNKNOWN';

            // Institutional Data Normalization: Coalesce metadata/details
            const details = entry.details ||
                (entry.metadata ? JSON.stringify(entry.metadata) : null) ||
                '{}';

            const ipAddress = entry.ipAddress || null;
            const userAgent = entry.userAgent || null;

            if (!action || action === 'UNKNOWN_ACTION') return;

            // INSERT with RETURNING so we have the canonical row (id, created_at,
            // server-side normalised details) for the live admin broadcast
            // below — without this, the broadcast payload would be a guess.
            const insertResult = await pool.query<AuditLogInsertedRow>(
                `INSERT INTO audit_logs (
                    user_id, action, entity_id, entity_type, details,
                    ip_address, user_agent, created_at
                )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
                 RETURNING id, user_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at`,
                [
                    userId,
                    action,
                    entityId,
                    entityType,
                    details,
                    ipAddress,
                    userAgent
                ]
            );

            const insertedRow: AuditLogInsertedRow | undefined = insertResult.rows[0];
            if (insertedRow === undefined) {
                // INSERT succeeded with zero RETURNING rows is theoretically
                // impossible for a non-conflicted INSERT but keep a defensive
                // narrowing in case a future ON CONFLICT clause is added.
                return;
            }

            // Resolve actor display fields for the admin broadcast. A separate
            // SELECT (instead of JOIN-on-INSERT) keeps the write path simple
            // and avoids constraining the audit_logs INSERT plan. Failure
            // here is logged but does not throw — the audit row is already
            // safely persisted; missing actor fields just render as null on
            // the admin surface.
            let actor: ActorJoinRow = { name: null, email: null, role: null };
            try {
                const actorResult = await pool.query<ActorJoinRow>(
                    `SELECT name, email, role FROM users WHERE id = $1`,
                    [insertedRow.user_id]
                );
                const fetched: ActorJoinRow | undefined = actorResult.rows[0];
                if (fetched !== undefined) {
                    actor = fetched;
                }
            } catch (actorError: unknown) {
                logger.warn('[Audit] Actor lookup failed (broadcast will use null)', {
                    error: actorError instanceof Error ? actorError.message : String(actorError),
                    userId: insertedRow.user_id,
                });
            }

            // Build the typed broadcast payload — shape matches `AuditLogEvent`
            // in `shared/schemas/admin-events.schema.ts`. Zod-validated inside
            // `emitToAdmins`.
            const broadcastPayload = {
                id: insertedRow.id,
                userId: insertedRow.user_id,
                action: insertedRow.action,
                entityType: insertedRow.entity_type,
                entityId: insertedRow.entity_id,
                details: normaliseDetailsForWire(insertedRow.details),
                ipAddress: insertedRow.ip_address,
                userAgent: insertedRow.user_agent,
                createdAt: insertedRow.created_at.toISOString(),
                userName: actor.name,
                userEmail: actor.email,
                userRole: actor.role,
            };

            emitToAdmins({ event: 'audit:new', payload: broadcastPayload });

            // Mirror security-relevant audit rows onto the dedicated channel.
            // Same pattern set as `securityRepository.getSecurityEvents` so
            // the live stream and the historic query agree.
            if (matchesSecurityPattern(insertedRow.action)) {
                // Re-classify against the shared suspicious heuristic so the
                // wire shape carries an accurate `isSuspicious` flag — this
                // is what drives the admin Security page's threat-level
                // computation.
                const securityPayload = {
                    id: insertedRow.id,
                    userId: insertedRow.user_id,
                    eventType: insertedRow.action,
                    eventCategory: 'Audit',
                    eventSeverity: 'Info',
                    ipAddress: insertedRow.ip_address,
                    userAgent: insertedRow.user_agent,
                    isSuspicious: isSuspiciousSecurityEvent({
                        eventType: insertedRow.action,
                        isSuspicious: false,
                    }),
                    createdAt: insertedRow.created_at.toISOString(),
                    userName: actor.name,
                    userEmail: actor.email,
                    userRole: actor.role,
                };
                emitToAdmins({ event: 'security:event', payload: securityPayload });
            }
        } catch (error: unknown) {
            logger.error('Failed to write audit log', {
                error: error instanceof Error ? error.message : String(error),
                userId: entry.userId,
                action: entry.action
            });
        }
    }
};
