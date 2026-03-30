import { pool } from '../config/db';
import { logger } from '../utils/logger';

export interface MedicalRecord {
    id: string;
    patient_id: string;
    name: string;
    file_path: string;
    file_data?: Buffer;
    file_mime?: string;
    file_size?: string;
    record_type?: string;
    status?: string;
    notes?: string;
    uploaded_at: Date;
    deleted_at?: Date;
}

export interface MedicalRecordRow {
    id: string;
    patient_id: string;
    name: string;
    file_path: string;
    file_mime?: string;
    file_size?: string;
    record_type?: string;
    status?: string;
    notes?: string;
    uploaded_at: Date;
    deleted_at?: Date;
    doctor_name?: string;
    facility_name?: string;
    date_of_service?: string;
}

export const recordRepository = {
    async findByPatientId(patientId: string): Promise<MedicalRecord[]> {
        try {
            const result = await pool.query<MedicalRecordRow>(
                'SELECT id, patient_id, name, file_path, file_mime, file_size, record_type, status, notes, uploaded_at FROM medical_records WHERE patient_id = $1 AND deleted_at IS NULL ORDER BY uploaded_at DESC',
                [patientId]
            );
            return result.rows;
        } catch (error: unknown) {
            logger.error('Failed to fetch medical records by patient ID', {
                error: error instanceof Error ? error.message : String(error),
                patientId
            });
            throw error;
        }
    },

    async findById(id: string, userId: string, role: string): Promise<MedicalRecord | null> {
        try {
            let query = '';
            let params: string[] = [];

            if (role === 'patient') {
                query = 'SELECT * FROM medical_records WHERE id = $1 AND patient_id = $2 AND deleted_at IS NULL';
                params = [id, userId];
            } else if (['doctor', 'pharmacist', 'admin'].includes(role)) {
                query = 'SELECT * FROM medical_records WHERE id = $1 AND deleted_at IS NULL';
                params = [id];
            } else {
                return null;
            }

            const result = await pool.query<MedicalRecordRow>(query, params);
            return result.rows.length ? result.rows[0] : null;
        } catch (error: unknown) {
            logger.error('Failed to fetch medical record by ID', {
                error: error instanceof Error ? error.message : String(error),
                id,
                userId,
                role
            });
            throw error;
        }
    },

    async create(data: {
        patientId: string;
        name: string;
        filePath: string;
        fileMime?: string;
        fileSize?: string;
        recordType?: string;
        status?: string;
        notes?: string;
    }): Promise<MedicalRecord> {
        try {
            const result = await pool.query<MedicalRecordRow>(
                `INSERT INTO medical_records (patient_id, name, file_path, file_mime, file_size, record_type, status, notes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING *`,
                [data.patientId, data.name, data.filePath, data.fileMime, data.fileSize, data.recordType, data.status, data.notes]
            );
            return result.rows[0];
        } catch (error: unknown) {
            logger.error('Failed to create medical record', {
                error: error instanceof Error ? error.message : String(error),
                patientId: data.patientId,
                name: data.name
            });
            throw error;
        }
    },

    async softDelete(id: string): Promise<void> {
        try {
            await pool.query('UPDATE medical_records SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
        } catch (error: unknown) {
            logger.error('Failed to soft delete medical record', {
                error: error instanceof Error ? error.message : String(error),
                id
            });
            throw error;
        }
    }
};
