import { Request, Response } from 'express';
import { pool } from '../config/db';
import fs from 'fs';
import path from 'path';

// Get patient's medical records
export const getMyRecords = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const patientId = user.id;

        const result = await pool.query(
            'SELECT * FROM medical_records WHERE patient_id = $1 AND deleted_at IS NULL ORDER BY uploaded_at DESC',
            [patientId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching medical records:', error);
        res.status(500).json({ message: 'Error fetching medical records' });
    }
};

// Upload a new medical record
export const uploadRecord = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const patientId = user.id;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { originalname, mimetype, size, buffer } = file;
        const fileSize = (size / 1024).toFixed(2) + ' KB';

        const result = await pool.query(`
            INSERT INTO medical_records (patient_id, name, file_path, file_data, file_mime, file_size, record_type, status, notes)
            VALUES ($1, $2, 'DB_ONLY', $3, $4, $5, 'Patient Upload', 'Pending Review', 'Uploaded by patient')
            RETURNING *
        `, [patientId, originalname, buffer, mimetype, fileSize]);



        res.status(201).json({
            message: 'Medical record uploaded successfully',
            record: result.rows[0]
        });
    } catch (error) {
        console.error('Error uploading medical record:', error);
        res.status(500).json({ message: 'Error uploading medical record' });
    }
};

// Delete a medical record
export const deleteRecord = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;
        const patientId = user.id;

        // Verify ownership
        const recordCheck = await pool.query(
            'SELECT file_path FROM medical_records WHERE id = $1 AND patient_id = $2',
            [id, patientId]
        );

        if (recordCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Record not found or access denied' });
        }

        const filePath = recordCheck.rows[0].file_path;

        // Soft delete: Update deleted_at timestamp
        await pool.query('UPDATE medical_records SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

        // Enterprise Compliance: Do NOT delete physical files.
        // We preserve them for audit and recovery purposes.

        res.json({ message: 'Medical record deleted successfully' });
    } catch (error) {
        console.error('Error deleting medical record:', error);
        res.status(500).json({ message: 'Error deleting medical record' });
    }
};
