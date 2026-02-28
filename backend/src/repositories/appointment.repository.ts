import { Pool } from 'pg';
import { pool } from '../config/db';

export interface Appointment {
    id: string;
    patient_id: string;
    doctor_id: string;
    appointment_date: string;
    appointment_time: string;
    consultation_type: string;
    reason: string | null;
    status: string;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface AppointmentWithDetails extends Appointment {
    doctor_name: string;
    patient_name: string;
    patient_phone: string;
    specialization: string;
    other_party_name?: string;
    user_role?: string;
}

export class AppointmentRepository {
    private db: Pool;

    constructor(db: Pool = pool) {
        this.db = db;
    }

    async checkDoctorVerified(doctorId: string): Promise<boolean> {
        const result = await this.db.query(`
            SELECT u.id FROM users u
            JOIN doctor_profiles dp ON u.id = dp.user_id
            WHERE u.id = $1 AND dp.is_verified = true
        `, [doctorId]);
        return result.rows.length > 0;
    }

    async checkConflict(doctorId: string, date: string, time: string): Promise<boolean> {
        const result = await this.db.query(`
            SELECT id FROM appointments
            WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3 
              AND status != 'cancelled' AND deleted_at IS NULL
        `, [doctorId, date, time]);
        return result.rows.length > 0;
    }

    async create(data: Partial<Appointment>): Promise<Appointment> {
        const result = await this.db.query(`
            INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, consultation_type, reason, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
            RETURNING *
        `, [data.patient_id, data.doctor_id, data.appointment_date, data.appointment_time, data.consultation_type, data.reason]);
        return result.rows[0];
    }

    async findByUserId(userId: string, status?: string, upcoming?: boolean): Promise<AppointmentWithDetails[]> {
        let query = `
            SELECT 
                a.*,
                CASE 
                    WHEN a.patient_id = $1 THEN u_doctor.name
                    ELSE u_patient.name
                END as other_party_name,
                CASE 
                    WHEN a.patient_id = $1 THEN 'patient'
                    ELSE 'doctor'
                END as user_role
            FROM appointments a
            LEFT JOIN users u_doctor ON a.doctor_id = u_doctor.id
            LEFT JOIN users u_patient ON a.patient_id = u_patient.id
            WHERE (a.patient_id = $1 OR a.doctor_id = $1) AND a.deleted_at IS NULL
        `;

        const params: (string | number | boolean | null)[] = [userId];

        if (status) {
            params.push(status as string);
            query += ` AND a.status = $${params.length}`;
        }

        if (upcoming) {
            query += ` AND a.appointment_date >= CURRENT_DATE`;
        }

        query += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';

        const result = await this.db.query(query, params);
        return result.rows;
    }

    async findByIdWithDetails(id: string, userId: string): Promise<AppointmentWithDetails | null> {
        const result = await this.db.query(`
            SELECT 
                a.*,
                u_doctor.name as doctor_name,
                u_patient.name as patient_name,
                u_patient.phone_number as patient_phone,
                dp.specialization
            FROM appointments a
            JOIN users u_doctor ON a.doctor_id = u_doctor.id
            JOIN users u_patient ON a.patient_id = u_patient.id
            LEFT JOIN doctor_profiles dp ON a.doctor_id = dp.user_id
            WHERE a.id = $1 AND (a.patient_id = $2 OR a.doctor_id = $2) AND a.deleted_at IS NULL
        `, [id, userId]);

        return result.rows[0] || null;
    }

    async updateStatus(id: string, doctorId: string, status: string, notes?: string): Promise<Appointment | null> {
        const result = await this.db.query(`
            UPDATE appointments
            SET status = $1, notes = COALESCE($2, notes), updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 AND doctor_id = $4 AND deleted_at IS NULL
            RETURNING *
        `, [status, notes || null, id, doctorId]);
        return result.rows[0] || null;
    }

    async cancel(id: string, userId: string): Promise<Appointment | null> {
        const result = await this.db.query(`
            UPDATE appointments
            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND (patient_id = $2 OR doctor_id = $2) AND deleted_at IS NULL
            RETURNING *
        `, [id, userId]);
        return result.rows[0] || null;
    }

    async getDoctorSchedule(doctorId: string, dayOfWeek: number): Promise<{ start_time: string; end_time: string }[]> {
        const result = await this.db.query(`
            SELECT start_time, end_time FROM doctor_schedules
            WHERE doctor_id = $1 AND day_of_week = $2 AND is_available = true
        `, [doctorId, dayOfWeek]);
        return result.rows;
    }

    async getBookedTimes(doctorId: string, date: string): Promise<string[]> {
        const result = await this.db.query(`
            SELECT appointment_time FROM appointments
            WHERE doctor_id = $1 AND appointment_date = $2 
              AND status != 'cancelled' AND deleted_at IS NULL
        `, [doctorId, date]);
        return result.rows.map(row => {
            const time = row.appointment_time;
            return typeof time === 'string' ? time.slice(0, 5) : time;
        });
    }

    async checkOwnership(id: string, userId: string): Promise<boolean> {
        const result = await this.db.query(
            'SELECT id FROM appointments WHERE id = $1 AND (patient_id = $2 OR doctor_id = $2)',
            [id, userId]
        );
        return result.rows.length > 0;
    }

    // Permanently remove a past/completed/cancelled appointment (patient only)
    // Institutional Soft delete (only for past/completed/cancelled)
    async softDelete(id: string, patientId: string): Promise<boolean> {
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
    }
}

export const appointmentRepository = new AppointmentRepository();
