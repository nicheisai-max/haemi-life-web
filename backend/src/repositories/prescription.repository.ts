import { Pool, PoolClient } from 'pg';
import { pool } from '../config/db';
import { logger } from '../utils/logger';

export interface Prescription {
    id: number;
    patient_id: string;
    doctor_id: string;
    appointment_id: number | null;
    notes: string | null;
    prescription_date: Date;
    status: string;
    created_at: Date;
    updated_at: Date;
}

export interface PrescriptionItem {
    id: number;
    prescription_id: number;
    medicine_id: number;
    dosage: string;
    frequency: string;
    duration_days: number | null;
    quantity: number | null;
    instructions: string | null;
}

export interface PrescriptionWithDetails extends Prescription {
    patient_name?: string;
    patient_phone?: string;
    doctor_name?: string;
    specialization?: string;
    medication_count?: number;
    items?: (PrescriptionItem & { medicine_name: string; category: string; strength: string })[];
}

export interface PrescriptionRow extends Prescription {
    patient_name?: string;
    patient_phone?: string;
    doctor_name?: string;
    specialization?: string;
    medication_count?: string | number;
}

export interface PrescriptionItemRow extends PrescriptionItem {
    medicine_name: string;
    category: string;
    strength: string;
}

export class PrescriptionRepository {
    private db: Pool;

    constructor(db: Pool = pool) {
        this.db = db;
    }

    async create(data: Partial<Prescription>, client?: PoolClient): Promise<Prescription> {
        const db = client || this.db;
        try {
            const result = await db.query<Prescription>(`
                INSERT INTO prescriptions (patient_id, doctor_id, appointment_id, notes, prescription_date, status)
                VALUES ($1, $2, $3, $4, CURRENT_DATE, 'pending')
                RETURNING *
            `, [data.patient_id, data.doctor_id, data.appointment_id ? Number(data.appointment_id) : null, data.notes]);
            return result.rows[0];
        } catch (error: unknown) {
            logger.error('Failed to create prescription', {
                error: error instanceof Error ? error.message : String(error),
                patientId: data.patient_id,
                doctorId: data.doctor_id
            });
            throw error;
        }
    }

    async createItem(item: Partial<PrescriptionItem>, client?: PoolClient): Promise<void> {
        const db = client || this.db;
        try {
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
        } catch (error: unknown) {
            logger.error('Failed to create prescription item', {
                error: error instanceof Error ? error.message : String(error),
                prescriptionId: item.prescription_id,
                medicineId: item.medicine_id
            });
            throw error;
        }
    }

    async findByUserId(userId: string, role: string): Promise<PrescriptionWithDetails[]> {
        try {
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
            const result = await this.db.query<PrescriptionRow>(query, [userId]);
            return result.rows.map(row => ({
                ...row,
                medication_count: row.medication_count ? Number(row.medication_count) : 0
            }));
        } catch (error: unknown) {
            logger.error('Failed to find prescriptions by user ID', {
                error: error instanceof Error ? error.message : String(error),
                userId,
                role
            });
            throw error;
        }
    }

    async findByIdWithDetails(id: number, userId: string, role: string): Promise<PrescriptionWithDetails | null> {
        try {
            const query = `
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
            `;
            const result = await this.db.query<PrescriptionRow>(query, [id, userId, role]);

            if (result.rows.length === 0) return null;
            const row = result.rows[0];
            return {
                ...row,
                medication_count: row.medication_count ? Number(row.medication_count) : 0
            };
        } catch (error: unknown) {
            logger.error('Failed to find prescription by ID with details', {
                error: error instanceof Error ? error.message : String(error),
                id,
                userId,
                role
            });
            throw error;
        }
    }

    async findItemsByPrescriptionId(id: number): Promise<PrescriptionItemRow[]> {
        try {
            const query = `
                SELECT 
                    pi.*,
                    m.name as medicine_name,
                    m.category,
                    m.strength
                FROM prescription_items pi
                LEFT JOIN medicines m ON pi.medicine_id = m.id
                WHERE pi.prescription_id = $1
            `;
            const result = await this.db.query<PrescriptionItemRow>(query, [id]);
            return result.rows;
        } catch (error: unknown) {
            logger.error('Failed to find prescription items', {
                error: error instanceof Error ? error.message : String(error),
                id
            });
            throw error;
        }
    }

    async updateStatus(id: number, status: string): Promise<Prescription | null> {
        try {
            const result = await this.db.query<Prescription>(`
                UPDATE prescriptions
                SET status = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `, [status, id]);
            return result.rows[0] || null;
        } catch (error: unknown) {
            logger.error('Failed to update prescription status', {
                error: error instanceof Error ? error.message : String(error),
                id,
                status
            });
            throw error;
        }
    }

    async findPending(): Promise<PrescriptionWithDetails[]> {
        try {
            const query = `
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
            `;
            const result = await this.db.query<PrescriptionRow>(query);
            return result.rows.map(row => ({
                ...row,
                medication_count: row.medication_count ? Number(row.medication_count) : 0
            }));
        } catch (error: unknown) {
            logger.error('Failed to find pending prescriptions', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    async checkAppointmentAccess(appointmentId: number, doctorId: string): Promise<boolean> {
        try {
            const result = await this.db.query<{ id: number }>(
                'SELECT id FROM appointments WHERE id = $1 AND doctor_id = $2 AND deleted_at IS NULL',
                [appointmentId, doctorId]
            );
            return result.rows.length > 0;
        } catch (error: unknown) {
            logger.error('Failed to check appointment access', {
                error: error instanceof Error ? error.message : String(error),
                appointmentId,
                doctorId
            });
            throw error;
        }
    }

    async softDelete(id: number, userId: string): Promise<boolean> {
        try {
            const result = await this.db.query(`
                UPDATE prescriptions
                SET deleted_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND (patient_id = $2 OR doctor_id = $2)
            `, [id, userId]);
            return (result.rowCount ?? 0) > 0;
        } catch (error: unknown) {
            logger.error('Failed to soft delete prescription', {
                error: error instanceof Error ? error.message : String(error),
                id,
                userId
            });
            throw error;
        }
    }
}

export const prescriptionRepository = new PrescriptionRepository();
