import { Request, Response } from 'express';
import { recordRepository } from '../repositories/record-repository';
import { sendResponse, sendError } from '../utils/response';
import { pool } from '../config/db';
import { logger } from '../utils/logger';
import { mapRecordToResponse } from '../utils/clinical.mapper';
import { fileService } from '../services/file.service';
import { ClinicalRecordType } from '../../../shared/clinical-types';

/**
 * 🩺 HAEMI LIFE — CLINICAL RECORD CONTROLLER
 * Life-cycle Management via Unified FileService
 */

// Get current patient's own medical records
export const getMyRecords = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { type } = req.query;

    try {
        if (!userId) return sendError(res, 401, 'Unauthorized');

        const records = await recordRepository.findByPatientId(userId, type as string);
        return sendResponse(res, 200, true, 'Medical records fetched', records.map(mapRecordToResponse));
    } catch (error: unknown) {
        logger.error('[Clinical-Record] My records fetch failure:', { 
            error: error instanceof Error ? error.message : String(error), 
            userId 
        });
        return sendError(res, 500, 'Error fetching medical records');
    }
};

// Get records for a specific patient (Doctor/Pharmacist oversight)
export const getPatientRecords = async (req: Request, res: Response) => {
    const user = req.user;
    const { patientId } = req.params;

    try {
        if (!user) return sendError(res, 401, 'Unauthorized');
        const userId = user.id;
        const role = user.role;

        if (role === 'patient' && userId !== patientId) {
            return sendError(res, 403, 'Unauthorized: Access to restricted medical records denied');
        }

        // Institutional Hardening: Relationship check for clinical roles
        if (role === 'doctor' || role === 'pharmacist') {
            const relationship = await pool.query<{ exists: number }>(
                `SELECT 1 as exists FROM appointments 
                 WHERE doctor_id = $1 AND patient_id = $2 
                 LIMIT 1`,
                [userId, patientId]
            );

            if (relationship.rows.length === 0 && role === 'doctor') {
                return sendError(res, 403, 'Clinical relationship required for medical record access');
            }
        }

        if (typeof patientId !== 'string') return sendError(res, 400, 'Invalid Patient ID (Institutional Standard)');
        
        const { type } = req.query;
        const records = await recordRepository.findByPatientId(patientId, type as string);
        return sendResponse(res, 200, true, 'Patient records fetched', records.map(mapRecordToResponse));
    } catch (error: unknown) {
        logger.error('[Clinical-Record] Patient records fetch failure:', { 
            error: error instanceof Error ? error.message : String(error), 
            patientId,
            requesterId: user?.id
        });
        return sendError(res, 500, 'Error fetching patient records');
    }
};

// Upload a new medical record (Patient only)
export const uploadRecord = async (req: Request, res: Response) => {
    const user = req.user;
    const file = req.file;

    try {
        if (!user) return sendError(res, 401, 'Unauthorized');
        const patientId = user.id;

        // 🛡️ INSTITUTIONAL BATCH LIMIT (Google/Meta Grade Rate Constraint)
        // Prevents sequential bypass of the 5-file limit by tracking recent activity.
        const recentUploads = await pool.query<{ count: string }>(`
            SELECT COUNT(*) as count 
            FROM medical_records 
            WHERE patient_id = $1 
            AND created_at >= CURRENT_TIMESTAMP - INTERVAL '1 minute'
        `, [patientId]);
        
        if (Number(recentUploads.rows[0].count) >= 5) {
            logger.warn('[Record-Controller] Security block: 5-file upload limit exceeded', { patientId });
            return sendError(res, 429, 'Institutional Security: Maximum batch upload limit (5 files) exceeded. Please wait a moment.');
        }

        if (!file) {
            return sendError(res, 400, 'Institutional Constraint: No clinical file provided');
        }

        const { originalname, mimetype, size, buffer } = file;
        const fileSizeStr = (size / 1024).toFixed(2) + ' KB'; // For record-specific metadata

        const { recordType, dateOfService } = req.body;

        // NEUROSURGICAL VALIDATION: Ensure recordType matches institutional Enum
        if (!recordType || !Object.values(ClinicalRecordType).includes(recordType as ClinicalRecordType)) {
            return sendError(res, 400, `Invalid clinical record type. Expected one of: ${Object.values(ClinicalRecordType).join(', ')}`);
        }

        // Institutional Save: Non-blocking async write via FileService
        const relativePath = await fileService.saveFileFromBuffer(buffer, 'medical_records', originalname);

        try {
            const newRecord = await recordRepository.create({
                patient_id: patientId,
                name: originalname,
                file_path: relativePath,
                file_mime: mimetype,
                file_size: fileSizeStr,
                record_type: recordType as ClinicalRecordType,
                status: 'Final',
                notes: 'Uploaded by patient',
                date_of_service: dateOfService
            });

            return sendResponse(res, 201, true, 'Medical record archived successfully', {
                record: mapRecordToResponse(newRecord)
            });
        } catch (dbError: unknown) {
            // Institutional Integrity: Rollback physical storage on DB failure
            await fileService.deletePhysicalFile(relativePath);
            throw dbError;
        }
    } catch (error: unknown) {
        logger.error('[Clinical-Record] Upload lifecycle failure:', { 
            error: error instanceof Error ? error.message : String(error), 
            userId: user?.id 
        });
        return sendError(res, 500, 'Critical error during clinical record upload');
    }
};

// Get a medical record by ID (Role-based access)
export const getRecordById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = req.user;

    try {
        if (!user) return sendError(res, 401, 'Unauthorized');
        const { id: userId, role } = user;

        if (typeof id !== 'string') return sendError(res, 400, 'Invalid Record ID (Strict)');
        const record = await recordRepository.findById(id, userId, role);

        if (!record) {
            return sendError(res, 404, 'Clinical record not found or access denied');
        }

        return sendResponse(res, 200, true, 'Clinical record retrieved', mapRecordToResponse(record));
    } catch (error: unknown) {
        logger.error('[Clinical-Record] Individual record fetch failure:', { 
            error: error instanceof Error ? error.message : String(error), 
            recordId: id,
            userId: user?.id 
        });
        return sendError(res, 500, 'Error fetching medical record');
    }
};

// Delete a medical record (Soft delete + Physical cleanup)
export const deleteRecord = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = req.user;

    try {
        if (!user) return sendError(res, 401, 'Unauthorized');
        const { id: userId, role } = user;

        if (role !== 'patient') {
            return sendError(res, 403, 'Institutional Standard: Only owners may purge clinical records');
        }

        if (typeof id !== 'string') return sendError(res, 400, 'Invalid Record ID');
        
        // 🛡️ FORENSIC LOOKUP: Include soft-deleted records to resolve replacement conflicts
        const record = await recordRepository.findById(id, userId, role, true);

        if (!record) {
            return sendError(res, 404, 'Record not found or access denied');
        }

        // 👻 GHOST HANDLING: If already soft-deleted, we skip redundant soft-delete and move to pure purge
        if (!record.deleted) {
            // Institutional Sequence: DB deletion confirmation MUST precede physical wipe 
            // to prevent data loss on DB failure.
            await recordRepository.softDelete(id, record.source_table);
        } else {
            logger.warn('[Haemi-Record] Purging existing ghost record for replacement:', { recordId: id });
        }

        // PRODUCTION HARDENING: Traceable, async quarantine instead of permanent deletion
        if (record.file_path && record.file_path !== 'DB_ONLY') {
            await fileService.quarantineFile(record.file_path);
        }

        // 🛡️ INSTITUTIONAL CLEANUP: If it's a replacement cycle, we hard-delete to clear the name collision
        if (record.deleted) {
            await recordRepository.hardDelete(id, record.source_table);
        }

        return sendResponse(res, 200, true, 'Medical record processed successfully for replacement/deletion');
    } catch (error: unknown) {
        logger.error('[Clinical-Record] Deletion lifecycle failure:', { 
            error: error instanceof Error ? error.message : String(error), 
            recordId: id,
            userId: user?.id 
        });
        return sendError(res, 500, 'Institutional protocol error during record purging');
    }
};

// Check if a file with this name exists for the patient (Forensic Check)
export const checkFileExistence = async (req: Request, res: Response) => {
    const user = req.user;
    const { name } = req.query;

    try {
        if (!user) return sendError(res, 401, 'Unauthorized');
        if (typeof name !== 'string') return sendError(res, 400, 'Filename required for forensic check');

        const record = await recordRepository.findByNameForPatient(user.id, name);

        if (record) {
            return sendResponse(res, 200, true, 'Potential duplicate clinical record identified', {
                exists: true,
                record: mapRecordToResponse(record)
            });
        }

        return sendResponse(res, 200, true, 'No existing record collision detected', { exists: false });
    } catch (error: unknown) {
        logger.error('[Clinical-Record] Forensic check failure:', { 
            error: error instanceof Error ? error.message : String(error), 
            userId: user?.id,
            filename: name 
        });
        return sendError(res, 500, 'Error during institutional forensic check');
    }
};
