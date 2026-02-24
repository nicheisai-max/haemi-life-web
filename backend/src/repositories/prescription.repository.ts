import { Pool, PoolClient } from 'pg';
import { pool } from '../config/db';

export interface Prescription {
    id: string;
    patient_id: string;
    doctor_id: string;
    appointment_id: string | null;
    notes: string | null;
    prescription_date: Date;
    status: string;
    created_at: Date;
    updated_at: Date;
}

export interface PrescriptionItem {
    id: string;
    prescription_id: string;
    medicine_id: string;
    dosage: string;
    frequency: string;
    duration_days: number | null;
    quantity: number | null;
    instructions: string | null;
}

export interface PrescriptionWithDetails extends Prescription {
    patient_name: string;
    patient_phone?: string;
    doctor_name: string;
    specialization?: string;
    medication_count?: number;
    items?: (PrescriptionItem & { medicine_name: string; category: string; strength: string })[];
}

export class PrescriptionRepository {
    private db: Pool;

    constructor(db: Pool = pool) {
        this.db = db;
    }

    async create(data: Partial<Prescription>, client?: PoolClient): Promise<Prescription> {
        const db = client || this.db;
        const result = await db.query(`
            INSERT INTO prescriptions (patient_id, doctor_id, appointment_id, notes, prescription_date, status)
            VALUES ($1, $2, $3, $4, CURRENT_DATE, 'pending')
            RETURNING *
        `, [data.patient_id, data.doctor_id, data.appointment_id || null, data.notes]);
        return result.rows[0];
    }

    async createItem(item: Partial<PrescriptionItem>, client?: PoolClient): Promise<void> {
        const db = client || this.db;
        await db.query(`
            INSERT INTO prescription_items 
            (prescription_id, medicine_id, dosage, frequency, duration_days, quantity, instructions)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            item.prescription_id,
            item.medicine_id,
            item.dosage,
            item.frequency,
            item.duration_days || null,
            item.quantity || null,
            item.instructions || null
        ]);
    }

    async findByUserId(userId: string, role: string): Promise<PrescriptionWithDetails[]> {
        const query = `
            SELECT 
                p.*,
                u_patient.name as patient_name,
                u_doctor.name as doctor_name,
                COUNT(pi.id) as medication_count
            FROM prescriptions p
            JOIN users u_patient ON p.patient_id = u_patient.id
            JOIN users u_doctor ON p.doctor_id = u_doctor.id
            LEFT JOIN prescription_items pi ON p.id = pi.prescription_id
            WHERE ${role === 'patient' ? 'p.patient_id' : 'p.doctor_id'} = $1 AND p.deleted_at IS NULL
            GROUP BY p.id, u_patient.name, u_doctor.name
            ORDER BY p.prescription_date DESC
        `;
        const result = await this.db.query(query, [userId]);
        return result.rows;
    }

    async findByIdWithDetails(id: string, userId: string, role: string): Promise<PrescriptionWithDetails | null> {
        const result = await this.db.query(`
            SELECT 
                p.*,
                u_patient.name as patient_name,
                u_patient.phone_number as patient_phone,
                u_doctor.name as doctor_name,
                dp.specialization
            FROM prescriptions p
            JOIN users u_patient ON p.patient_id = u_patient.id
            JOIN users u_doctor ON p.doctor_id = u_doctor.id
            LEFT JOIN doctor_profiles dp ON p.doctor_id = dp.user_id
            WHERE p.id = $1 AND (p.patient_id = $2 OR p.doctor_id = $2 OR $3 = 'pharmacist') AND p.deleted_at IS NULL
        `, [id, userId, role]);

        if (result.rows.length === 0) return null;
        return result.rows[0];
    }

    async findItemsByPrescriptionId(id: string): Promise<any[]> {
        const result = await this.db.query(`
            SELECT 
                pi.*,
                m.name as medicine_name,
                m.category,
                m.strength
            FROM prescription_items pi
            LEFT JOIN medicines m ON pi.medicine_id = m.id
            WHERE pi.prescription_id = $1
        `, [id]);
        return result.rows;
    }

    async updateStatus(id: string, status: string): Promise<Prescription | null> {
        const result = await this.db.query(`
            UPDATE prescriptions
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `, [status, id]);
        return result.rows[0] || null;
    }

    async findPending(): Promise<PrescriptionWithDetails[]> {
        const result = await this.db.query(`
            SELECT 
                p.*,
                u_patient.name as patient_name,
                u_patient.phone_number as patient_phone,
                u_doctor.name as doctor_name,
                COUNT(pi.id) as medication_count
            FROM prescriptions p
            JOIN users u_patient ON p.patient_id = u_patient.id
            JOIN users u_doctor ON p.doctor_id = u_doctor.id
            LEFT JOIN prescription_items pi ON p.id = pi.prescription_id
            WHERE p.status = 'pending' AND p.deleted_at IS NULL
            GROUP BY p.id, u_patient.name, u_patient.phone_number, u_doctor.name
            ORDER BY p.prescription_date ASC
        `);
        return result.rows;
    }

    async checkAppointmentAccess(appointmentId: string, doctorId: string): Promise<boolean> {
        const result = await this.db.query(
            'SELECT id FROM appointments WHERE id = $1 AND doctor_id = $2 AND deleted_at IS NULL',
            [appointmentId, doctorId]
        );
        return result.rows.length > 0;
    }

    async softDelete(id: string, userId: string): Promise<boolean> {
        const result = await this.db.query(`
            UPDATE prescriptions
            SET deleted_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND (patient_id = $2 OR doctor_id = $2)
        `, [id, userId]);
        return (result.rowCount ?? 0) > 0;
    }
}

export const prescriptionRepository = new PrescriptionRepository();
