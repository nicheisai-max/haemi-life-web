import { Request, Response } from 'express';
import { recordRepository } from '../repositories/record-repository';
import { sendResponse, sendError } from '../utils/response';
import { JWTPayload } from '../types/express';

// Get patient's medical records
export const getMyRecords = async (req: Request, res: Response) => {
    try {
        const user = req.user as JWTPayload;
        if (!user) return sendError(res, 401, 'Unauthorized');
        const patientId = user.id;

        const records = await recordRepository.findByPatientId(patientId as string);
        sendResponse(res, 200, true, 'Medical records fetched', records);
    } catch (error) {
        console.error('Error fetching medical records:', error);
        sendError(res, 500, 'Error fetching medical records');
    }
};

// Upload a new medical record
export const uploadRecord = async (req: Request, res: Response) => {
    try {
        const user = req.user as JWTPayload;
        if (!user) return sendError(res, 401, 'Unauthorized');
        const patientId = user.id;
        const file = req.file;

        if (!file) {
            return sendError(res, 400, 'No file uploaded');
        }

        const { originalname, mimetype, size, buffer } = file;
        const fileSize = (size / 1024).toFixed(2) + ' KB';

        const newRecord = await recordRepository.create({
            patientId: patientId as string,
            name: originalname,
            filePath: 'DB_ONLY', // Indicate file stored in DB
            fileData: buffer,
            fileMime: mimetype,
            fileSize: fileSize,
            recordType: 'Patient Upload',
            status: 'Pending Review',
            notes: 'Uploaded by patient'
        });

        sendResponse(res, 201, true, 'Medical record uploaded successfully', {
            record: newRecord
        });
    } catch (error) {
        console.error('Error uploading medical record:', error);
        sendError(res, 500, 'Error uploading medical record');
    }
};

// Get a medical record by ID
export const getRecordById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = req.user;
        if (!user) return sendError(res, 401, 'Unauthorized');

        const record = await recordRepository.findById(id as string, user.id as string);

        if (!record) {
            return sendError(res, 404, 'Record not found or access denied');
        }

        sendResponse(res, 200, true, 'Medical record fetched', record);
    } catch (error) {
        console.error('Error fetching medical record by ID:', error);
        sendError(res, 500, 'Error fetching medical record');
    }
};

// Delete a medical record (soft delete)
export const deleteRecord = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = req.user;
        if (!user) return sendError(res, 401, 'Unauthorized');

        const record = await recordRepository.findById(id as string, user.id as string);

        if (!record) {
            return sendError(res, 404, 'Record not found or access denied');
        }

        await recordRepository.softDelete(id as string);

        // Enterprise Compliance: Do NOT delete physical files.
        // We preserve them for audit and recovery purposes.

        sendResponse(res, 200, true, 'Medical record deleted successfully');
    } catch (error) {
        console.error('Error deleting medical record:', error);
        sendError(res, 500, 'Error deleting medical record');
    }
};
