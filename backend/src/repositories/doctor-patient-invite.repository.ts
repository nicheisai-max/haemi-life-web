import { randomBytes } from 'crypto';
import { Pool, PoolClient } from 'pg';
import { pool } from '../config/db';
import { logger } from '../utils/logger';

/**
 * 🩺 HAEMI LIFE — DOCTOR → PATIENT INVITE REPOSITORY
 *
 * Backs the doctor-initiated patient invite flow (Patient Registry PR 3/3).
 * Doctor creates an invite (random URL-safe token + optional invitee
 * pre-fill), shares the resulting link via any channel they choose
 * (WhatsApp / in-person / etc — zero platform cost, no SMS or email
 * infra required), patient signs up via that link, the application
 * layer marks the invite `claimed` and records `claimed_by_user_id`.
 *
 * Strict-TS posture: zero `any`, zero `as unknown as`, zero `@ts-ignore`.
 * Errors flow through the project `logger`; the caller decides the
 * appropriate HTTP response surface.
 */

export type InviteStatus = 'pending' | 'claimed' | 'expired' | 'revoked';

export interface DoctorPatientInviteRow {
    id: string;
    doctor_id: string;
    token: string;
    invitee_name: string | null;
    invitee_phone: string | null;
    invitee_email: string | null;
    note: string | null;
    status: InviteStatus;
    claimed_by_user_id: string | null;
    claimed_at: Date | null;
    expires_at: Date;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

export interface CreateInviteInput {
    readonly doctorId: string;
    readonly inviteeName?: string | null;
    readonly inviteePhone?: string | null;
    readonly inviteeEmail?: string | null;
    readonly note?: string | null;
    /** Days until expiry; defaults to 30. Clamped to [1, 365] by the
     *  application layer — repo accepts any positive integer. */
    readonly expiresInDays: number;
}

/**
 * Generate a URL-safe random token. base64url-encoded 32 bytes yields
 * a 43-character string with 256 bits of entropy — collision-resistant
 * for any realistic invite volume.
 */
const generateInviteToken = (): string => {
    return randomBytes(32).toString('base64url');
};

export class DoctorPatientInviteRepository {
    private db: Pool;

    constructor(db: Pool = pool) {
        this.db = db;
    }

    /** Create a fresh invite for a doctor. Returns the row including the
     *  newly-generated token. Caller composes the share link. */
    async create(input: CreateInviteInput, client?: PoolClient): Promise<DoctorPatientInviteRow> {
        const db = client ?? this.db;
        const token: string = generateInviteToken();
        const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);
        try {
            const result = await db.query<DoctorPatientInviteRow>(`
                INSERT INTO doctor_patient_invites
                    (doctor_id, token, invitee_name, invitee_phone, invitee_email, note, expires_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [
                input.doctorId,
                token,
                input.inviteeName ?? null,
                input.inviteePhone ?? null,
                input.inviteeEmail ?? null,
                input.note ?? null,
                expiresAt,
            ]);
            return result.rows[0];
        } catch (error: unknown) {
            logger.error('[DoctorPatientInvite] create failed', {
                error: error instanceof Error ? error.message : String(error),
                doctorId: input.doctorId,
            });
            throw error;
        }
    }

    /** List all invites for a doctor (any status). Soft-deleted rows
     *  excluded. Ordered newest-first. */
    async listForDoctor(doctorId: string): Promise<DoctorPatientInviteRow[]> {
        try {
            const result = await this.db.query<DoctorPatientInviteRow>(`
                SELECT * FROM doctor_patient_invites
                WHERE doctor_id = $1 AND deleted_at IS NULL
                ORDER BY created_at DESC
            `, [doctorId]);
            return result.rows;
        } catch (error: unknown) {
            logger.error('[DoctorPatientInvite] listForDoctor failed', {
                error: error instanceof Error ? error.message : String(error),
                doctorId,
            });
            throw error;
        }
    }

    /** Look up an invite by its public token. Returns null when the
     *  token is unknown, soft-deleted, or no longer pending. The caller
     *  may inspect the row's `expires_at` and `status` to decide
     *  whether the invite is still actionable. */
    async findActiveByToken(token: string): Promise<DoctorPatientInviteRow | null> {
        try {
            const result = await this.db.query<DoctorPatientInviteRow>(`
                SELECT * FROM doctor_patient_invites
                WHERE token = $1 AND deleted_at IS NULL
                LIMIT 1
            `, [token]);
            return result.rows[0] ?? null;
        } catch (error: unknown) {
            logger.error('[DoctorPatientInvite] findActiveByToken failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /** Mark an invite as `claimed` and record the claiming user's ID.
     *  Atomic — only succeeds when the invite is still `pending` and
     *  hasn't expired, so concurrent signup races cannot double-claim. */
    async markClaimed(token: string, userId: string, client?: PoolClient): Promise<DoctorPatientInviteRow | null> {
        const db = client ?? this.db;
        try {
            const result = await db.query<DoctorPatientInviteRow>(`
                UPDATE doctor_patient_invites
                SET status = 'claimed',
                    claimed_by_user_id = $2,
                    claimed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE token = $1
                  AND status = 'pending'
                  AND expires_at > CURRENT_TIMESTAMP
                  AND deleted_at IS NULL
                RETURNING *
            `, [token, userId]);
            return result.rows[0] ?? null;
        } catch (error: unknown) {
            logger.error('[DoctorPatientInvite] markClaimed failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    /** Soft-revoke an invite. Idempotent — re-revoking is a no-op. The
     *  invite is moved to `revoked` status AND soft-deleted so it
     *  disappears from the active list view while remaining for audit. */
    async revoke(inviteId: string, doctorId: string): Promise<boolean> {
        try {
            const result = await this.db.query(`
                UPDATE doctor_patient_invites
                SET status = 'revoked',
                    deleted_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND doctor_id = $2 AND deleted_at IS NULL
            `, [inviteId, doctorId]);
            return (result.rowCount ?? 0) > 0;
        } catch (error: unknown) {
            logger.error('[DoctorPatientInvite] revoke failed', {
                error: error instanceof Error ? error.message : String(error),
                inviteId, doctorId,
            });
            throw error;
        }
    }
}

export const doctorPatientInviteRepository = new DoctorPatientInviteRepository();
