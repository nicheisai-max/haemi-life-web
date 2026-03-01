import { Request, Response } from 'express';
import { pool } from '../config/db';
import { JWTPayload } from '../types/express';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';

export const getProfileImage = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const result = await pool.query(
            'SELECT profile_image_data, profile_image_mime, profile_image FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, 'User not found');
        }

        const user = result.rows[0];

        // 1. Try to serve from DB (BYTEA)
        if (user.profile_image_data && user.profile_image_mime) {
            res.setHeader('Content-Type', user.profile_image_mime);
            res.setHeader('Cache-Control', 'no-cache');
            return res.send(user.profile_image_data);
        }

        // 2. Fallback to existing path if available (Legacy Support)
        if (user.profile_image) {
            return res.redirect(user.profile_image);
        }

        return sendError(res, 404, 'Profile image not found');
    } catch (error: unknown) {
        logger.error('Error fetching profile image:', { error: (error as Error).message, userId: req.params.userId });
        return sendError(res, 500, 'Internal Server Error');
    }
};

export const getChatAttachment = async (req: Request, res: Response) => {
    try {
        const { messageId } = req.params;
        const user = req.user as JWTPayload;

        // BOLA Fix: Check if user is a participant in the conversation this message belongs to
        const accessCheck = await pool.query(`
            SELECT m.attachment_data, m.attachment_mime, m.attachment_url, m.attachment_name
            FROM messages m
            JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
            WHERE m.id = $1 AND cp.user_id = $2
        `, [messageId, user.id]);

        if (accessCheck.rows.length === 0) {
            return sendError(res, 403, 'Access denied to attachment');
        }

        const message = accessCheck.rows[0];

        if (message.attachment_data && message.attachment_mime) {
            res.setHeader('Content-Type', message.attachment_mime);
            const safeFileName = (message.attachment_name || `attachment-${messageId}`).replace(/[^a-z0-9\-.]/gi, '_');
            res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
            return res.send(message.attachment_data);
        }

        if (message.attachment_url) {
            return res.redirect(message.attachment_url);
        }

        return sendError(res, 404, 'Attachment not found');
    } catch (error: unknown) {
        logger.error('Error fetching chat attachment:', { error: (error as Error).message, messageId: req.params.messageId });
        return sendError(res, 500, 'Internal Server Error');
    }
};

export const getMedicalRecordFile = async (req: Request, res: Response) => {
    try {
        const { recordId } = req.params;
        const user = req.user as JWTPayload;

        // BOLA Fix: Patients can only see their own records. Doctors/Admins can see any record.
        let query = `
            SELECT file_data, file_mime, file_path 
            FROM medical_records 
            WHERE id = $1 AND deleted_at IS NULL
        `;
        const params: (string | number)[] = [recordId as string];

        if (user.role === 'patient') {
            query += ' AND patient_id = $2';
            params.push(user.id);
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return sendError(res, 403, 'Access denied or record not found');
        }

        const record = result.rows[0];

        if (record.file_data && record.file_mime) {
            res.setHeader('Content-Type', record.file_mime);
            return res.send(record.file_data);
        }

        if (record.file_path) {
            return res.redirect(`/${record.file_path}`);
        }

        return sendError(res, 404, 'Record file not found');
    } catch (error: unknown) {
        logger.error('Error fetching medical record file:', { error: (error as Error).message, recordId: req.params.recordId });
        return sendError(res, 500, 'Internal Server Error');
    }
};
