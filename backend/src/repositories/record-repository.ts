import { ClinicalRecordType, ClinicalRecordStatus } from '../../../shared/clinical-types';
import { pool } from '../config/db';
import { logger } from '../utils/logger';

export interface MedicalRecordRow {
    id: string | number;
    patient_id: string;
    name: string;
    file_path: string;
    file_mime?: string;
    file_size?: string | number;
    record_type: ClinicalRecordType | string;
    status: ClinicalRecordStatus | string;
    notes?: string;
    uploaded_at: Date | string;
    deleted_at?: Date | string | null;
    deleted?: boolean;
    doctor_name?: string;
    facility_name?: string;
    date_of_service?: string;
    source_table: 'medical_records' | 'prescriptions';
}

export const recordRepository = {
    /**
     * 🩺 HAEMI LIFE — UNIFIED CLINICAL HISTORY (Google/Meta Grade)
     * Performs a high-performance UNION across medical_records and prescription_files
     * ensuring a single "One Source of Truth" for Doctors and Patients.
     */
    async findByPatientId(patientId: string, category?: string): Promise<MedicalRecordRow[]> {
        try {
            /** 
             * P0 FIX: Institutional Schema Alignment (Forensic Corrected)
             * Mismatch: prescription_files table has NO file_size column.
             * Fix: Using explicit NULL::text and type-casting for all columns.
             */
            
            // Institutional Search: Standard Medical Records
            const recordsQuery = `
                SELECT 
                    id::text, patient_id::text, name, file_path, file_mime, file_size::text, 
                    record_type::text, status::text, notes, uploaded_at, 
                    date_of_service::text, doctor_name, facility_name,
                    'medical_records' as source_table
                FROM medical_records 
                WHERE patient_id = $1 AND deleted_at IS NULL
            `;

            // Institutional Search: Prescriptions mapped as clinical records (Verified Schema)
            const prescriptionsQuery = `
                SELECT 
                    pf.id::text, p.patient_id::text, pf.file_name as name, pf.file_path, pf.file_mime, NULL::text as file_size, 
                    'Prescription' as record_type, p.status::text as status, p.notes, p.created_at as uploaded_at, 
                    p.prescription_date::text as date_of_service, u.name as doctor_name, 'Haemi Life Virtual' as facility_name,
                    'prescriptions' as source_table
                FROM prescription_files pf
                JOIN prescriptions p ON pf.prescription_id = p.id
                JOIN users u ON p.doctor_id = u.id
                WHERE p.patient_id = $1 AND p.deleted_at IS NULL
            `;

            let finalQuery = '';
            const params: string[] = [patientId];

            if (category === 'Prescription') {
                // 🛡️ INSTITUTIONAL RECOVERY: Include Doctor-issued AND Patient-uploaded (fuzzy name match) prescriptions.
                // We normalize record_type to 'Prescription' at the query level to allow frontend filtering parity.
                finalQuery = `
                    (SELECT 
                        id::text, patient_id::text, name, file_path, file_mime, file_size::text, 
                        'Prescription'::text as record_type, status::text, notes, uploaded_at, 
                        date_of_service::text, doctor_name, facility_name,
                        'medical_records' as source_table
                    FROM medical_records 
                    WHERE patient_id = $1 
                    AND (record_type = 'Prescription' OR name ILIKE '%prescription%') 
                    AND deleted_at IS NULL)
                    UNION ALL
                    (${prescriptionsQuery})
                `;
            } else {
                // MASTER LOGIC: COMPLETE clinical history
                finalQuery = `(${recordsQuery}) UNION ALL (${prescriptionsQuery})`;
                
                if (category && category !== 'All') {
                    // Specific Category Filter
                    finalQuery = `SELECT * FROM (${finalQuery}) as unified WHERE record_type = $2`;
                    params.push(category);
                }
            }

            finalQuery += ' ORDER BY uploaded_at DESC';

            const result = await pool.query<MedicalRecordRow>(finalQuery, params);
            return result.rows;
        } catch (error: unknown) {
            logger.error('[Haemi-Unified] Failed to fetch unified clinical history:', {
                error: (error instanceof Error) ? error.message : String(error),
                stack: (error instanceof Error) ? error.stack : undefined,
                patientId,
                category
            });
            throw error;
        }
    },

    async findById(id: string, userId: string, role: string, includeDeleted: boolean = false): Promise<MedicalRecordRow | null> {
        try {
            const query = `
                SELECT * FROM (
                    SELECT 
                        id::text, patient_id::text, name, file_path, file_mime, file_size::text, 
                        record_type::text, status::text, notes, uploaded_at, 
                        date_of_service::text, doctor_name, facility_name,
                        'medical_records' as source_table, (deleted_at IS NOT NULL) as deleted 
                    FROM medical_records 
                    WHERE (deleted_at IS NULL OR $2 = true)
                    UNION ALL
                    SELECT 
                        pf.id::text, p.patient_id::text, pf.file_name as name, pf.file_path, pf.file_mime, NULL::text as file_size, 
                        'Prescription' as record_type, p.status::text as status, p.notes, p.created_at as uploaded_at, 
                        p.prescription_date::text as date_of_service, u.name as doctor_name, 'Haemi Life Virtual' as facility_name,
                        'prescriptions' as source_table, (p.deleted_at IS NOT NULL) as deleted 
                    FROM prescription_files pf 
                    JOIN prescriptions p ON pf.prescription_id = p.id 
                    JOIN users u ON p.doctor_id = u.id
                    WHERE (p.deleted_at IS NULL OR $2 = true)
                ) as unified
                WHERE id = $1
            `;
            const result = await pool.query<MedicalRecordRow>(query, [id, includeDeleted]);
            if (result.rows.length === 0) return null;

            const record = result.rows[0];

            if (role === 'patient' && record.patient_id !== userId) {
                return null;
            }

            return record;
        } catch (error: unknown) {
            logger.error('[Haemi-Unified] Single record lookup failed:', {
                error: (error instanceof Error) ? error.message : String(error),
                id,
                userId
            });
            throw error;
        }
    },

    async create(data: Partial<MedicalRecordRow>): Promise<MedicalRecordRow> {
        const query = `
            INSERT INTO medical_records (patient_id, name, file_path, file_mime, file_size, record_type, status, notes, date_of_service)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *, 'medical_records' as source_table
        `;
        const values = [
            data.patient_id, data.name, data.file_path, data.file_mime, 
            data.file_size, data.record_type, data.status, data.notes, data.date_of_service
        ];
        
        try {
            const result = await pool.query<MedicalRecordRow>(query, values);
            return result.rows[0];
        } catch (error: unknown) {
            logger.error('[Haemi-Repo] Record creation failure:', {
                error: (error instanceof Error) ? error.message : String(error),
                patientId: data.patient_id
            });
            throw error;
        }
    },

    async softDelete(id: string, sourceTable: string = 'medical_records'): Promise<boolean> {
        try {
            let query = '';
            const params: [string] = [id];

            if (sourceTable === 'prescriptions') {
                // For prescriptions, the ID passed is usually the prescription_file ID
                // We soft delete the underlying prescription
                query = `
                    UPDATE prescriptions 
                    SET deleted_at = NOW() 
                    WHERE id = (SELECT prescription_id FROM prescription_files WHERE id::text = $1)
                `;
            } else {
                query = "UPDATE medical_records SET deleted_at = NOW() WHERE id::text = $1";
            }

            const result = await pool.query(query, params);
            return (result.rowCount ?? 0) > 0;
        } catch (error: unknown) {
            logger.error('[Haemi-Repo] Soft delete failure:', {
                error: (error instanceof Error) ? error.message : String(error),
                id,
                sourceTable
            });
            throw error;
        }
    },

    /**
     * 🛡️ INSTITUTIONAL PURGE: Permanent DB deletion (Only for replacement conflicts)
     */
    async hardDelete(id: string, sourceTable: string = 'medical_records'): Promise<boolean> {
        try {
            let query = '';
            if (sourceTable === 'prescriptions') {
                query = 'DELETE FROM prescription_files WHERE id::text = $1';
            } else {
                query = 'DELETE FROM medical_records WHERE id::text = $1';
            }

            const result = await pool.query(query, [id]);
            return (result.rowCount ?? 0) > 0;
        } catch (error: unknown) {
            logger.error('[Haemi-Repo] Institutional purge failure:', {
                error: (error instanceof Error) ? error.message : String(error),
                id,
                sourceTable
            });
            throw error;
        }
    },

    /**
     * 🔍 FORENSIC EXISTENCE CHECK (v4.0)
     * Searches for a record by name across all clinical tables for a patient.
     * Crucially, it IGNORES the deleted_at filter to find quarantined duplicates.
     */
    async findByNameForPatient(patientId: string, name: string): Promise<MedicalRecordRow | null> {
        try {
            const query = `
                SELECT * FROM (
                    SELECT 
                        id::text, patient_id::text, name, file_path, file_mime, file_size::text, 
                        record_type::text, status::text, notes, uploaded_at, 
                        date_of_service::text, doctor_name, facility_name,
                        'medical_records' as source_table 
                    FROM medical_records
                    UNION ALL
                    SELECT 
                        pf.id::text, p.patient_id::text, pf.file_name as name, pf.file_path, pf.file_mime, NULL::text as file_size, 
                        'Prescription' as record_type, p.status::text as status, p.notes, p.created_at as uploaded_at, 
                        p.prescription_date::text as date_of_service, u.name as doctor_name, 'Haemi Life Virtual' as facility_name,
                        'prescriptions' as source_table 
                    FROM prescription_files pf
                    JOIN prescriptions p ON pf.prescription_id = p.id
                    JOIN users u ON p.doctor_id = u.id
                ) as unified
                WHERE patient_id = $1 AND name = $2
                LIMIT 1
            `;
            const result = await pool.query<MedicalRecordRow>(query, [patientId, name]);
            return result.rows[0] || null;
        } catch (error: unknown) {
            logger.error('[Haemi-Repo] Forensic name lookup failed:', {
                error: (error instanceof Error) ? error.message : String(error),
                patientId,
                name
            });
            throw error;
        }
    }
};
