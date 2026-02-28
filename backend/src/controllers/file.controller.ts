import { Request, Response } from 'express';
import { pool } from '../config/db';
import { JWTPayload } from '../types/express';

export const getProfileImage = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const result = await pool.query(
            'SELECT profile_image_data, profile_image_mime, profile_image FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = result.rows[0];

        // 1. Try to serve from DB (BYTEA)
        if (user.profile_image_data && user.profile_image_mime) {
            res.setHeader('Content-Type', user.profile_image_mime);
            res.setHeader('Cache-Control', 'no-cache'); // Always revalidate — profile images change
            return res.send(user.profile_image_data);
        }

        // 2. Fallback to existing path if available (Legacy Support)
        if (user.profile_image) {
            // For now, redirect to the old path or handle logic elsewhere.
            // Since we are standardizing, we should probably handle the redirect here
            // to maintain a single source of truth for the frontend URL.
            // But since the frontend uses http://localhost:5000/api/files/profile/:id,
            // we should probably just serve the file from disk if it exists.
            return res.redirect(user.profile_image);
        }

        res.status(404).json({ message: 'Image not found' });
    } catch (error) {
        console.error('Error fetching profile image:', error);
        res.status(500).json({ message: 'Server error' });
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
            return res.status(403).json({ message: 'Access denied. You are not a participant in this conversation.' });
        }

        const message = accessCheck.rows[0];

        if (message.attachment_data && message.attachment_mime) {
            res.setHeader('Content-Type', message.attachment_mime);
            // Send the original filename so the browser saves with the right name and extension
            const safeFileName = (message.attachment_name || `attachment-${messageId}`).replace(/[^a-z0-9\-.]/gi, '_');
            res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
            return res.send(message.attachment_data);
        }

        if (message.attachment_url) {
            return res.redirect(message.attachment_url);
        }

        res.status(404).json({ message: 'Attachment not found' });
    } catch (error) {
        console.error('Error fetching chat attachment:', error);
        res.status(500).json({ message: 'Server error' });
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
            return res.status(403).json({ message: 'Access denied or record not found' });
        }

        const record = result.rows[0];

        if (record.file_data && record.file_mime) {
            res.setHeader('Content-Type', record.file_mime);
            return res.send(record.file_data);
        }

        if (record.file_path) {
            // Institutional Hardening: Prevent direct static guesswork by serving via controller
            return res.redirect(`/${record.file_path}`);
        }

        res.status(404).json({ message: 'File not found' });
    } catch (error) {
        console.error('Error fetching medical record:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
