import { Pool } from 'pg';
import { pool } from '../config/db';
import { logger } from '../utils/logger';
import { auditService, SYSTEM_ANONYMOUS_ID } from '../services/audit.service';

export interface Appointment {
    id: number;
    patient_id: string;
    doctor_id: string;
    appointment_date: string;
    appointment_time: string;
    duration_minutes: number;
    consultation_type: string;
    reason: string | null;
    status: string;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface AppointmentWithDetails extends Appointment {
    doctor_name?: string;
    patient_name?: string;
    patient_phone?: string;
    specialization?: string;
    other_party_name?: string;
    user_role?: string;
    profile_image?: string | null;
    profile_image_mime?: string | null;
}

interface InstitutionalError extends Error {
    code?: string;
}

export class AppointmentRepository {
    private db: Pool;

    constructor(db: Pool = pool) {
        this.db = db;
    }

    async checkDoctorVerified(doctorId: string): Promise<boolean> {
        try {
            const result = await this.db.query<{ id: string }>(`
                SELECT u.id FROM users u
                JOIN doctor_profiles dp ON u.id = dp.user_id
                WHERE u.id = $1 AND dp.is_verified = true
            `, [doctorId]);
            return result.rows.length > 0;
        } catch (error: unknown) {
            logger.error('Failed to check doctor verification', {
                error: error instanceof Error ? error.message : String(error),
                doctorId
            });
            throw error;
        }
    }

    async checkConflict(doctorId: string, date: string, time: string): Promise<boolean> {
        try {
            const result = await this.db.query<{ id: number }>(`
                SELECT id FROM appointments
                WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3 
                AND status != 'cancelled' AND deleted_at IS NULL
            `, [doctorId, date, time]);
            return result.rows.length > 0;
        } catch (error: unknown) {
            logger.error('Failed to check appointment conflict', {
                error: error instanceof Error ? error.message : String(error),
                doctorId,
                date,
                time
            });
            throw error;
        }
    }

    async create(data: Partial<Appointment>): Promise<Appointment> {
        const client = await this.db.connect();
        try {
            await client.query('BEGIN');

            // --- Institutional Concurrency Guard: Row-Level Lock ---
            // Locking the potential conflict rows to prevent race conditions during peak booking bursts.
            const conflictCheck = await client.query(`
                SELECT id FROM appointments
                WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3 
                AND status != 'cancelled' AND deleted_at IS NULL
                FOR UPDATE
            `, [data.doctor_id, data.appointment_date, data.appointment_time]);

            if (conflictCheck.rows.length > 0) {
                const conflictError: Error = new Error('This time slot has just been reserved by another patient.');
                // Attaching institutional error code for controller-level handling
                (conflictError as InstitutionalError).code = 'SLOT_ALREADY_BOOKED'; 
                throw conflictError;
            }

            const result = await client.query<Appointment>(`
                INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, consultation_type, reason, status)
                VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
                RETURNING *
            `, [data.patient_id, data.doctor_id, data.appointment_date, data.appointment_time, data.consultation_type, data.reason]);

            await client.query('COMMIT');
            return result.rows[0];
        } catch (error: unknown) {
            await client.query('ROLLBACK');
            
            // Google/Meta Grade Strict Narrowing
            const errorMessage: string = error instanceof Error ? error.message : String(error);
            const errorCode: string = (error as { code?: string })?.code || 'UNKNOWN_ERROR';

            logger.error('Failed to create appointment securely', { 
                error: errorMessage, 
                errorCode,
                patientId: data.patient_id,
                doctorId: data.doctor_id 
            });

            // Institutional Logging: Recording the failure for forensic audit
            await auditService.log({
                userId: data.patient_id || SYSTEM_ANONYMOUS_ID,
                action: 'APPOINTMENT_CREATION_FAILURE',
                entityType: 'APPOINTMENT',
                metadata: { 
                    error: errorMessage, 
                    errorCode,
                    doctorId: data.doctor_id,
                    date: data.appointment_date,
                    time: data.appointment_time
                }
            });

            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Find appointments for a user (patient or doctor).
     *
     * Doctor-side filter: when `viewerRole === 'doctor'`, rows where
     * `doctor_archived = true` are hidden from the response — these are
     * appointments the doctor has cleaned up from their list. The patient
     * still sees them in their own view (the doctor's archive flag is
     * independent of the patient's `deleted_at` soft-delete).
     */
    async findByUserId(
        userId: string,
        viewerRole: 'patient' | 'doctor' | undefined,
        status?: string,
        upcoming?: boolean
    ): Promise<AppointmentWithDetails[]> {
        try {
            let query = `
                SELECT
                    a.*,
                    CASE
                        WHEN a.patient_id = $1 THEN u_doctor.name
                        ELSE u_patient.name
                    END as other_party_name,
                    CASE
                        WHEN a.patient_id = $1 THEN u_doctor.profile_image
                        ELSE u_patient.profile_image
                    END as profile_image,
                    CASE
                        WHEN a.patient_id = $1 THEN u_doctor.profile_image_mime
                        ELSE u_patient.profile_image_mime
                    END as profile_image_mime,
                    CASE
                        WHEN a.patient_id = $1 THEN 'patient'
                        ELSE 'doctor'
                    END as user_role
                FROM appointments a
                LEFT JOIN users u_doctor ON a.doctor_id = u_doctor.id
                LEFT JOIN users u_patient ON a.patient_id = u_patient.id
                WHERE (a.patient_id = $1 OR a.doctor_id = $1) AND a.deleted_at IS NULL
            `;

            const params: string[] = [userId];

            // Doctor-side housekeeping: hide rows the doctor archived.
            // Patient view is unaffected.
            if (viewerRole === 'doctor') {
                query += ' AND a.doctor_archived = false';
            }

            if (status) {
                params.push(status);
                query += ` AND a.status = $${params.length}`;
            }

            if (upcoming) {
                query += ` AND (a.appointment_date + a.appointment_time) >= CURRENT_TIMESTAMP`;
                query += ' ORDER BY a.appointment_date ASC, a.appointment_time ASC';
            } else {
                query += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';
            }

            const result = await this.db.query<AppointmentWithDetails>(query, params);
            return result.rows;
        } catch (error: unknown) {
            logger.error('Failed to find appointments by user ID', {
                error: error instanceof Error ? error.message : String(error),
                userId,
                viewerRole,
                status,
                upcoming
            });
            throw error;
        }
    }

    async findByIdWithDetails(id: number, userId: string): Promise<AppointmentWithDetails | null> {
        try {
            const result = await this.db.query<AppointmentWithDetails>(`
                SELECT
                    a.*,
                    u_doctor.name as doctor_name,
                    u_patient.name as patient_name,
                    u_patient.phone_number as patient_phone,
                    CASE
                        WHEN a.patient_id = $2 THEN u_doctor.profile_image
                        ELSE u_patient.profile_image
                    END as profile_image,
                    CASE
                        WHEN a.patient_id = $2 THEN u_doctor.profile_image_mime
                        ELSE u_patient.profile_image_mime
                    END as profile_image_mime,
                    dp.specialization
                FROM appointments a
                JOIN users u_doctor ON a.doctor_id = u_doctor.id
                JOIN users u_patient ON a.patient_id = u_patient.id
                LEFT JOIN doctor_profiles dp ON a.doctor_id = dp.user_id
                WHERE a.id = $1 AND (a.patient_id = $2 OR a.doctor_id = $2) AND a.deleted_at IS NULL
            `, [id, userId]);

            return result.rows[0] || null;
        } catch (error: unknown) {
            logger.error('Failed to find appointment by ID with details', {
                error: error instanceof Error ? error.message : String(error),
                id,
                userId
            });
            throw error;
        }
    }

    async updateStatus(id: number, doctorId: string, status: string, notes?: string): Promise<Appointment | null> {
        try {
            const result = await this.db.query<Appointment>(`
                UPDATE appointments
                SET status = $1, notes = COALESCE($2, notes), updated_at = CURRENT_TIMESTAMP
                WHERE id = $3 AND doctor_id = $4 AND deleted_at IS NULL
                RETURNING *
            `, [status, notes || null, id, doctorId]);
            return result.rows[0] || null;
        } catch (error: unknown) {
            logger.error('Failed to update appointment status', {
                error: error instanceof Error ? error.message : String(error),
                id,
                doctorId,
                status
            });
            throw error;
        }
    }

    async cancel(id: number, userId: string): Promise<Appointment | null> {
        try {
            const result = await this.db.query<Appointment>(`
                UPDATE appointments
                SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND (patient_id = $2 OR doctor_id = $2) AND deleted_at IS NULL
                RETURNING *
            `, [id, userId]);
            return result.rows[0] || null;
        } catch (error: unknown) {
            logger.error('Failed to cancel appointment', {
                error: error instanceof Error ? error.message : String(error),
                id,
                userId
            });
            throw error;
        }
    }

    async getDoctorSchedule(doctorId: string, dayOfWeek: number): Promise<{ start_time: string; end_time: string }[]> {
        try {
            const result = await this.db.query<{ start_time: string; end_time: string }>(`
                SELECT start_time, end_time FROM doctor_schedules
                WHERE doctor_id = $1 AND day_of_week = $2 AND is_available = true
            `, [doctorId, dayOfWeek]);
            return result.rows;
        } catch (error: unknown) {
            logger.error('Failed to get doctor schedule', {
                error: error instanceof Error ? error.message : String(error),
                doctorId,
                dayOfWeek
            });
            throw error;
        }
    }

    async getBookedTimes(doctorId: string, date: string): Promise<string[]> {
        try {
            const result = await this.db.query<{ appointment_time: string }>(`
                SELECT appointment_time FROM appointments
                WHERE doctor_id = $1 AND appointment_date = $2 
                  AND status != 'cancelled' AND deleted_at IS NULL
            `, [doctorId, date]);
            return result.rows.map((row: { appointment_time: string }) => {
                const time: string = row.appointment_time;
                return typeof time === 'string' ? time.slice(0, 5) : String(time).slice(0, 5);
            });
        } catch (error: unknown) {
            logger.error('Failed to get booked times', {
                error: error instanceof Error ? error.message : String(error),
                doctorId,
                date
            });
            throw error;
        }
    }

    async checkOwnership(id: number, userId: string): Promise<boolean> {
        try {
            // P0 SOFT-DELETE GUARD: ownership of a soft-deleted appointment must
            // not authorize any subsequent operation.
            const result = await this.db.query<{ id: number }>(
                'SELECT id FROM appointments WHERE id = $1 AND (patient_id = $2 OR doctor_id = $2) AND deleted_at IS NULL',
                [id, userId]
            );
            return result.rows.length > 0;
        } catch (error: unknown) {
            logger.error('Failed to check appointment ownership', {
                error: error instanceof Error ? error.message : String(error),
                id,
                userId
            });
            throw error;
        }
    }

    // Permanently remove a past/completed/cancelled appointment (patient only)
    // Institutional Soft delete (only for past/completed/cancelled)
    async softDelete(id: number, patientId: string): Promise<boolean> {
        try {
            const result = await this.db.query(`
                UPDATE appointments
                SET deleted_at = CURRENT_TIMESTAMP
                WHERE id = $1
                  AND patient_id = $2
                  AND (
                        appointment_date < CURRENT_DATE
                        OR status IN ('completed', 'cancelled')
                      )
            `, [id, patientId]);
            return (result.rowCount ?? 0) > 0;
        } catch (error: unknown) {
            logger.error('Failed to soft delete appointment', {
                error: error instanceof Error ? error.message : String(error),
                id,
                patientId
            });
            throw error;
        }
    }

    /**
     * Doctor-side soft-archive: hides the row from the doctor's list while
     * leaving the patient's view, audit trail, and clinical record intact.
     * Restricted to terminal-state rows (completed / cancelled / no-show)
     * so a doctor cannot accidentally remove a still-active appointment
     * from their own view. Returns `true` only when a row matched and was
     * updated.
     */
    async archiveForDoctor(id: number, doctorId: string): Promise<boolean> {
        try {
            const result = await this.db.query(`
                UPDATE appointments
                SET doctor_archived = true, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                  AND doctor_id = $2
                  AND deleted_at IS NULL
                  AND doctor_archived = false
                  AND status IN ('completed', 'cancelled', 'no-show')
            `, [id, doctorId]);
            return (result.rowCount ?? 0) > 0;
        } catch (error: unknown) {
            logger.error('Failed to archive appointment for doctor', {
                error: error instanceof Error ? error.message : String(error),
                id,
                doctorId
            });
            throw error;
        }
    }

    /**
     * Overdue scan for the cron monitor. Returns scheduled appointments
     * whose start instant + 15 minutes has passed AND that have NOT yet
     * been notified (`overdue_notified_at IS NULL`). The 15-minute grace
     * window is fixed in the WHERE clause; if it ever needs to be
     * configurable per doctor, the threshold becomes a parameter.
     *
     * Returns the rows joined with patient name so the broadcast payload
     * can render "Tebogo did not arrive" without the consumer doing a
     * second lookup.
     */
    async findOverdueScheduled(graceMinutes: number = 15): Promise<Array<{
        id: number;
        patient_id: string;
        doctor_id: string;
        appointment_date: string;
        appointment_time: string;
        patient_name: string | null;
    }>> {
        try {
            const result = await this.db.query<{
                id: number;
                patient_id: string;
                doctor_id: string;
                appointment_date: string;
                appointment_time: string;
                patient_name: string | null;
            }>(`
                SELECT
                    a.id,
                    a.patient_id,
                    a.doctor_id,
                    a.appointment_date::text AS appointment_date,
                    a.appointment_time::text AS appointment_time,
                    u_patient.name AS patient_name
                FROM appointments a
                LEFT JOIN users u_patient ON a.patient_id = u_patient.id
                WHERE a.status = 'scheduled'
                  AND a.deleted_at IS NULL
                  AND a.overdue_notified_at IS NULL
                  AND (a.appointment_date + a.appointment_time + ($1 * INTERVAL '1 minute')) <= CURRENT_TIMESTAMP
            `, [graceMinutes]);
            return result.rows;
        } catch (error: unknown) {
            logger.error('Failed to find overdue scheduled appointments', {
                error: error instanceof Error ? error.message : String(error),
                graceMinutes
            });
            throw error;
        }
    }

    /**
     * Stamp `overdue_notified_at` on a row that the monitor has just
     * broadcast for. Idempotent — subsequent ticks skip rows whose stamp
     * is non-null. Returns `true` when the row was successfully marked.
     */
    async markOverdueNotified(id: number): Promise<boolean> {
        try {
            const result = await this.db.query(`
                UPDATE appointments
                SET overdue_notified_at = CURRENT_TIMESTAMP
                WHERE id = $1
                  AND overdue_notified_at IS NULL
            `, [id]);
            return (result.rowCount ?? 0) > 0;
        } catch (error: unknown) {
            logger.error('Failed to mark appointment overdue-notified', {
                error: error instanceof Error ? error.message : String(error),
                id
            });
            throw error;
        }
    }
}

export const appointmentRepository = new AppointmentRepository();
