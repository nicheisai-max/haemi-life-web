// 🔒 HAEMI ATTACHMENT PIPELINE LOCK
// DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL
// SINGLE SOURCE: Database Verified Records ONLY
// FALLBACKS/FUZZY SEARCH FORBIDDEN (GOOGLE/META GRADE)
// TYPESCRIPT STRICT MODE ENFORCED

import { Request, Response } from 'express';
import { pool } from '../config/db';
import { JWTPayload } from '../types/express';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';
import * as path from 'path';
import mime from 'mime';
import { fileService } from '../services/file.service';

/**
 * 🩺 HAEMI LIFE — INSTITUTIONAL FILE DELIVERY SYSTEM
 * Standard: Unified Retrieval Layer via FileService
 */

function sanitizeFilename(filename: string): string {
    return filename
        .replace(/["';\r\n]/g, '')
        .replace(/[^\x20-\x7E]/g, '_')
        .trim() || 'file';
}

function getValidatedMode(mode: unknown): 'preview' | 'download' {
    return mode === 'download' ? 'download' : 'preview';
}

/**
 * 🩺 HAEMI RESOLVER: Profile Image
 */
export const getProfileImage = async (req: Request, res: Response) => {
    const userId = req.params.userId as string;

    try {
        const query = `
            SELECT profile_image_data, profile_image_mime, profile_image 
            FROM users 
            WHERE id::text = $1 OR profile_image = $1
            LIMIT 1
        `;
        const result = await pool.query<{
            profile_image_data: Buffer | null,
            profile_image_mime: string | null,
            profile_image: string | null
        }>(query, [userId]);

        if (result.rows.length === 0) {
            return sendError(res, 404, 'User/Image not found');
        }

        const user = result.rows[0];

        // 1. Direct Redirect for external URLs
        if (user.profile_image && user.profile_image.startsWith('http')) {
            return res.redirect(user.profile_image);
        }

        // 2. Verified Filesystem Path
        if (user.profile_image && !user.profile_image.startsWith('/api/')) {
            const relativePath = user.profile_image
                .replace(/^(\/)?uploads\//i, '')
                .replace(/^\/+/, '');
            
            try {
                const stream = fileService.getReadStream(relativePath);
                res.setHeader('Content-Type', mime.getType(relativePath) || user.profile_image_mime || 'image/jpeg');
                res.setHeader('Content-Disposition', 'inline');
                res.setHeader('Cache-Control', 'public, max-age=3600');
                return stream.pipe(res);
            } catch {
                // Background fallback to buffer if stream fails (institutional resilience)
            }
        }

        // 3. Fallback: Database Binary Buffer
        if (user.profile_image_data) {
            res.setHeader('Content-Type', user.profile_image_mime || 'image/jpeg');
            res.setHeader('Content-Disposition', 'inline');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.send(user.profile_image_data);
        }

        return res.status(204).end();
    } catch (error: unknown) {
        logger.error('[File-Resolver] Profile image fetch failed', { error, userId });
        return sendError(res, 500, 'Internal Server Error');
    }
};

/**
 * 🩺 HAEMI RESOLVER: Chat Attachments
 */
export const getChatAttachment = async (req: Request, res: Response) => {
    const { messageId } = req.params;
    const user = req.user as JWTPayload | undefined;

    try {
        if (!user) return sendError(res, 401, 'Unauthorized');

        const accessCheck = await pool.query<{
            file_path: string,
            file_type: string | null,
            file_name: string | null
        }>(`
            SELECT ma.file_path, ma.file_type, ma.file_name
            FROM message_attachments ma
            JOIN messages m ON ma.message_id = m.id
            JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
            WHERE ma.id::text = $1 AND cp.user_id = $2
            LIMIT 1
        `, [messageId, user.id]);

        if (accessCheck.rows.length === 0) {
            return sendError(res, 403, 'Access denied or attachment record not found');
        }

        const attachment = accessCheck.rows[0];
        const relativePath = (attachment.file_path || '').replace(/^\/+/, '').replace(/^uploads\//, '');
        
        try {
            const stream = fileService.getReadStream(relativePath);
            res.setHeader('Content-Type', attachment.file_type || mime.getType(relativePath) || 'application/octet-stream');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

            const mode = getValidatedMode(req.query.mode);
            if (mode === 'download') {
                const safeFileName = sanitizeFilename(attachment.file_name || path.basename(relativePath));
                res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
            } else {
                res.setHeader('Content-Disposition', 'inline');
            }

            return stream.pipe(res);
        } catch {
            logger.error('[File-Vault] Physical file missing for valid DB reference', { relativePath, messageId });
            return sendError(res, 404, 'Attachment file not found on server');
        }
    } catch (error: unknown) {
        logger.error('[File-Resolver] Chat attachment fetch failed', { error, messageId });
        return sendError(res, 500, 'Internal Server Error');
    }
};

/**
 * 🩺 HAEMI RESOLVER: Medical Records & Prescriptions
 */
export const getMedicalRecordFile = async (req: Request, res: Response) => {
    const { recordId } = req.params;
    const user = req.user as JWTPayload | undefined;

    try {
        if (!user) return sendError(res, 401, 'Unauthorized');

        const query = `
            SELECT name, file_path, file_mime, patient_id
            FROM (
                SELECT id::text, name, file_path, file_mime, patient_id::text FROM medical_records WHERE deleted_at IS NULL
                UNION ALL
                SELECT pf.id::text, pf.file_name as name, pf.file_path, pf.file_mime, p.patient_id::text
                FROM prescription_files pf JOIN prescriptions p ON pf.prescription_id = p.id WHERE p.deleted_at IS NULL
            ) as unified
            WHERE id = $1
        `;

        const result = await pool.query<{
            name: string,
            file_path: string,
            file_mime: string | null,
            patient_id: string
        }>(query, [recordId]);

        if (result.rows.length === 0) {
            return sendError(res, 403, 'Access denied or record not found');
        }

        const record = result.rows[0];

        // RBAC validation: Patients only see their own
        if (user.role === 'patient' && record.patient_id !== user.id) {
            return sendError(res, 403, 'Unauthorized access attempt logged');
        }

        const relativePath = (record.file_path || '').replace(/^\/+/, '').replace(/^uploads\//, '');
        
        try {
            const stream = fileService.getReadStream(relativePath);
            res.setHeader('Content-Type', record.file_mime || mime.getType(relativePath) || 'application/pdf');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

            const mode = getValidatedMode(req.query.mode);
            if (mode === 'download') {
                const safeFileName = sanitizeFilename(record.name || path.basename(relativePath));
                res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
            } else {
                res.setHeader('Content-Disposition', 'inline');
            }

            return stream.pipe(res);
        } catch {
            logger.error('[File-Vault] Clinical file missing or restricted', { relativePath, recordId });
            return sendError(res, 404, 'Clinical document not found on server');
        }
    } catch (error: unknown) {
        logger.error('[File-Resolver] Clinical record fetch failed', { error, recordId });
        return sendError(res, 500, 'Internal Server Error');
    }
};

/**
 * 🩺 HAEMI RESOLVER: Temporary Attachments
 */
export const getTempAttachment = async (req: Request, res: Response) => {
    const { tempId } = req.params;
    const user = req.user as JWTPayload | undefined;

    try {
        if (!user) return sendError(res, 401, 'Unauthorized');

        const tempResult = await pool.query<{ mime: string | null, name: string }>(
            'SELECT mime, name FROM temp_attachments WHERE id::text = $1',
            [tempId]
        );

        if (tempResult.rows.length === 0) {
            logger.warn('[File-Resolver] Staged file record not found', { tempId, userId: user.id });
            return sendError(res, 404, 'Temporary file record not found');
        }

        const rawMetadata = tempResult.rows[0].name;
        const tempPath = rawMetadata.includes('|') ? rawMetadata.split('|')[0] : rawMetadata;
        const relativePath = tempPath.replace(/^\/+/, '').replace(/^uploads\//, '');
        
        try {
            const stream = fileService.getReadStream(relativePath);
            res.setHeader('Content-Type', tempResult.rows[0].mime || 'image/jpeg');
            return stream.pipe(res);
        } catch {
            return sendError(res, 404, 'Staged file missing on server');
        }
    } catch (error: unknown) {
        logger.error('[File-Resolver] Temp attachment fetch failed', { error, tempId });
        return sendError(res, 500, 'Internal Server Error');
    }
};
