import { Request, Response } from 'express';
import { recordRepository } from '../repositories/record-repository';
import { sendResponse, sendError } from '../utils/response';
import { pool } from '../config/db';
import { logger } from '../utils/logger';
import { mapRecordToResponse } from '../utils/clinical.mapper';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

// Get current patient's own medical records
export const getMyRecords = async (req: Request, res: Response) => {
    const userId = req.user?.id;

    try {
        if (!userId) return sendError(res, 401, 'Unauthorized');

        const records = await recordRepository.findByPatientId(userId);
        return sendResponse(res, 200, true, 'Medical records fetched', records.map(mapRecordToResponse));
    } catch (error: unknown) {
        logger.error('Error fetching medical records:', { 
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
            return sendError(res, 403, 'Cannot access other patients records');
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
                return sendError(res, 403, 'No clinical relationship established with this patient');
            }
        }

        if (typeof patientId !== 'string') return sendError(res, 400, 'Invalid Patient ID');
        const records = await recordRepository.findByPatientId(patientId);
        return sendResponse(res, 200, true, 'Patient records fetched', records.map(mapRecordToResponse));
    } catch (error: unknown) {
        logger.error('Error fetching patient records:', { 
            error: error instanceof Error ? error.message : String(error), 
            patientId,
            userId: user?.id
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

        if (!file) {
            return sendError(res, 400, 'No file uploaded');
        }

        const { originalname, mimetype, size, buffer } = file;
        const fileSize = (size / 1024).toFixed(2) + ' KB';

        // PRODUCTION HARDENING: Filesystem Offloading
        const fileExt = path.extname(originalname);
        const uniqueFileName = `${crypto.randomUUID()}${fileExt}`;
        const relativePath = `uploads/medical_records/${uniqueFileName}`;
        const fullPath = path.join(path.resolve(__dirname, '../../'), relativePath);

        // Ensure directory exists (Defensive)
        const dirPath = path.dirname(fullPath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // Write to filesystem
        fs.writeFileSync(fullPath, buffer);

        const newRecord = await recordRepository.create({
            patientId: patientId,
            name: originalname,
            filePath: relativePath,
            fileMime: mimetype,
            fileSize: fileSize,
            recordType: 'Patient Upload',
            status: 'Final',
            notes: 'Uploaded by patient'
        });

        return sendResponse(res, 201, true, 'Medical record uploaded successfully', {
            record: mapRecordToResponse(newRecord)
        });
    } catch (error: unknown) {
        logger.error('Error uploading medical record:', { 
            error: error instanceof Error ? error.message : String(error), 
            userId: user?.id 
        });
        return sendError(res, 500, 'Error uploading medical record');
    }
};

// Get a medical record by ID (Role-based access)
export const getRecordById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = req.user;

    try {
        if (!user) return sendError(res, 401, 'Unauthorized');
        const { id: userId, role } = user;

        if (typeof id !== 'string') return sendError(res, 400, 'Invalid Record ID');
        const record = await recordRepository.findById(id, userId, role);

        if (!record) {
            return sendError(res, 404, 'Record not found or access denied');
        }

        return sendResponse(res, 200, true, 'Medical record fetched', mapRecordToResponse(record));
    } catch (error: unknown) {
        logger.error('Error fetching medical record by ID:', { 
            error: error instanceof Error ? error.message : String(error), 
            recordId: id,
            userId: user?.id 
        });
        return sendError(res, 500, 'Error fetching medical record');
    }
};

// Delete a medical record (Soft delete, Patient owner only)
export const deleteRecord = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = req.user;

    try {
        if (!user) return sendError(res, 401, 'Unauthorized');
        const { id: userId, role } = user;

        if (role !== 'patient') {
            return sendError(res, 403, 'Only patients can delete their own records');
        }

        if (typeof id !== 'string') return sendError(res, 400, 'Invalid Record ID');
        const record = await recordRepository.findById(id, userId, role);

        if (!record) {
            return sendError(res, 404, 'Record not found or access denied');
        }

        await recordRepository.softDelete(id);

        // PRODUCTION HARDENING: Cleanup filesystem on delete
        if (record.file_path && record.file_path !== 'DB_ONLY') {
            const fullPath = path.join(path.resolve(__dirname, '../../'), record.file_path);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        }

        return sendResponse(res, 200, true, 'Medical record deleted successfully');
    } catch (error: unknown) {
        logger.error('Error deleting medical record:', { 
            error: error instanceof Error ? error.message : String(error), 
            recordId: id,
            userId: user?.id 
        });
        return sendError(res, 500, 'Error deleting medical record');
    }
};
