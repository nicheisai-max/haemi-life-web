import { pool } from '../config/db';

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

export const recordRepository = {
    async findByPatientId(patientId: string): Promise<MedicalRecord[]> {
        const result = await pool.query(
            'SELECT id, patient_id, name, file_path, file_mime, file_size, record_type, status, notes, uploaded_at FROM medical_records WHERE patient_id = $1 AND deleted_at IS NULL ORDER BY uploaded_at DESC',
            [patientId]
        );
        return result.rows;
    },

    async findById(id: string, userId: string, role: string): Promise<MedicalRecord | null> {
        let query = '';
        let params: (string | number | boolean | null)[] = [];

        if (role === 'patient') {
            query = 'SELECT * FROM medical_records WHERE id = $1 AND patient_id = $2 AND deleted_at IS NULL';
            params = [id, userId];
        } else if (role === 'doctor' || role === 'pharmacist' || role === 'admin') {
            // Doctors and Pharmacists can view any record they have the ID for (Enterprise Context)
            // Admin has full oversight.
            query = 'SELECT * FROM medical_records WHERE id = $1 AND deleted_at IS NULL';
            params = [id];
        } else {
            return null;
        }

        const result = await pool.query(query, params);
        return result.rows.length ? result.rows[0] : null;
    },

    async create(data: {
        patientId: string;
        name: string;
        filePath: string;
        fileData?: Buffer;
        fileMime?: string;
        fileSize?: string;
        recordType?: string;
        status?: string;
        notes?: string;
    }): Promise<MedicalRecord> {
        const result = await pool.query(
            `INSERT INTO medical_records (patient_id, name, file_path, file_data, file_mime, file_size, record_type, status, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [data.patientId, data.name, data.filePath, data.fileData, data.fileMime, data.fileSize, data.recordType, data.status, data.notes]
        );
        return result.rows[0];
    },

    async softDelete(id: string): Promise<void> {
        await pool.query('UPDATE medical_records SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    }
};
