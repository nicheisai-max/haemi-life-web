import { Request, Response } from 'express';
import { pool } from '../config/db';
import { JWTPayload } from '../types/express';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';
import mime from 'mime';

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

        // 1. Serve from Filesystem (Production Hardened)
        if (user.profile_image && !user.profile_image.startsWith('/api/')) {
            const normalizedPath = path.normalize(user.profile_image).replace(/^(\.\.(\/|\\|$))+/, '');
            const fullPath = path.resolve(process.cwd(), normalizedPath);
            
            // Path Traversal Protection
            if (!fullPath.startsWith(process.cwd())) {
                return sendError(res, 403, 'Restricted path');
            }

            if (fs.existsSync(fullPath)) {
                // P1 FIX: Detect MIME using library
                const detectedMime = mime.getType(fullPath) || user.profile_image_mime || 'image/jpeg';
                res.type(detectedMime);
                res.set('Content-Disposition', `inline; filename="profile-${userId}${path.extname(user.profile_image)}"`);
                res.set('Cache-Control', 'public, max-age=3600');
                
                const stream = fs.createReadStream(fullPath);
                stream.on('error', (err) => {
                    logger.error('Stream error:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ success: false, message: 'Internal Server Error' });
                    }
                });
                return stream.pipe(res);
            } else {
                return sendError(res, 404, 'Profile image file not found on server');
            }
        }

        // 2. Fallback to Redirect if it's a legacy external URL
        if (user.profile_image && user.profile_image.startsWith('http')) {
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

        if (message.attachment_url && !message.attachment_url.startsWith('/api/')) {
            const normalizedPath = path.normalize(message.attachment_url).replace(/^(\.\.(\/|\\|$))+/, '');
            const fullPath = path.resolve(process.cwd(), normalizedPath);

            // Path Traversal Protection
            if (!fullPath.startsWith(process.cwd())) {
                return sendError(res, 403, 'Restricted path');
            }

            if (fs.existsSync(fullPath)) {
                // P1 FIX: Detect MIME using library
                const detectedMime = mime.getType(fullPath) || message.attachment_mime || 'application/octet-stream';
                res.type(detectedMime);
                const safeFileName = (message.attachment_name || `attachment-${messageId}`).replace(/[^a-z0-9\-.]/gi, '_');
                res.set('Content-Disposition', `attachment; filename="${safeFileName}"`);
                
                const stream = fs.createReadStream(fullPath);
                stream.on('error', (err) => {
                    logger.error('Stream error:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ success: false, message: 'Internal Server Error' });
                    }
                });
                return stream.pipe(res);
            } else {
                return sendError(res, 404, 'Attachment file not found on server');
            }
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
            SELECT name, file_data, file_mime, file_path 
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

        if (record.file_path && record.file_path !== 'DB_ONLY') {
            const normalizedPath = path.normalize(record.file_path).replace(/^(\.\.(\/|\\|$))+/, '');
            const fullPath = path.resolve(process.cwd(), normalizedPath);

            // Path Traversal Protection
            if (!fullPath.startsWith(process.cwd())) {
                return sendError(res, 403, 'Restricted path');
            }

            if (fs.existsSync(fullPath)) {
                // P1 FIX: Detect MIME using library
                const detectedMime = mime.getType(fullPath) || record.file_mime || 'application/octet-stream';
                res.type(detectedMime);
                const safeFileName = (record.name || `record-${recordId}`).replace(/[^a-z0-9\-.]/gi, '_');
                res.set('Content-Disposition', `attachment; filename="${safeFileName}"`);
                
                const stream = fs.createReadStream(fullPath);
                stream.on('error', (err) => {
                    logger.error('Stream error:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ success: false, message: 'Internal Server Error' });
                    }
                });
                return stream.pipe(res);
            } else {
                return sendError(res, 404, 'Medical record file not found on server');
            }
        }

        return sendError(res, 404, 'Record file not found');
    } catch (error: unknown) {
        logger.error('Error fetching medical record file:', { error: (error as Error).message, recordId: req.params.recordId });
        return sendError(res, 500, 'Internal Server Error');
    }
};
