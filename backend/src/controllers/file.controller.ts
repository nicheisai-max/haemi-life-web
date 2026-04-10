import { Request, Response } from 'express';
import { pool } from '../config/db';
import { JWTPayload } from '../types/express';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';
import * as path from 'path';
import mime from 'mime';
import { fileService } from '../services/file.service';
import { pipeline } from 'stream/promises';

/**
 * 🩺 HAEMI LIFE — INSTITUTIONAL FILE DELIVERY SYSTEM (v5.0)
 * Standard: Google/Meta Strict Type Parity & Zero-Drift Metadata
 * Protocol: Verified Binary Tunneling
 */

/**
 * 🛡️ INSTITUTIONAL FILENAME SANITIZER
 * Ensures compliance with RFC 6266 while preserving extension integrity.
 */
function sanitizeFilename(filename: string): string {
    return filename
        .replace(/["';\r\n]/g, '') // Strip injection characters
        .replace(/[^\x20-\x7E]/g, '_') // Normalize non-ASCII
        .trim() || 'haemi_clinical_file';
}

function getValidatedMode(mode: unknown): 'preview' | 'download' {
    return mode === 'download' ? 'download' : 'preview';
}

/**
 * 🩺 HAEMI RESOLVER: Profile Image
 */
export const getProfileImage = async (req: Request, res: Response): Promise<void> => {
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
            sendError(res, 404, 'User/Image not found');
            return;
        }

        const user = result.rows[0];

        // 1. Direct Redirect for external URLs
        if (user.profile_image && user.profile_image.startsWith('http')) {
            res.redirect(user.profile_image);
            return;
        }

        // 🧬 Institutional Header Set
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // 2. Verified Filesystem Path
        if (user.profile_image && !user.profile_image.startsWith('/api/')) {
            const relativePath = user.profile_image
                .replace(/^(\/)?uploads\//i, '')
                .replace(/^\/+/, '');
            
            try {
                const stats = await fileService.getFileStats(relativePath);
                if (!stats) {
                    sendError(res, 404, 'Image file missing on server');
                    return;
                }

                res.setHeader('Content-Type', mime.getType(relativePath) || user.profile_image_mime || 'image/jpeg');
                res.setHeader('Content-Length', stats.size);
                res.setHeader('Content-Disposition', 'inline');
                res.setHeader('Cache-Control', 'public, max-age=3600');

                const stream = fileService.getReadStream(relativePath);
                await pipeline(stream, res);
                return;
            } catch (err: unknown) {
                logger.warn('[File-Resolver] Profile stream failed, falling back to buffer', { 
                    userId, 
                    error: err instanceof Error ? err.message : String(err) 
                });
            }
        }

        // 3. Fallback: Database Binary Buffer
        if (user.profile_image_data) {
            res.setHeader('Content-Type', user.profile_image_mime || 'image/jpeg');
            res.setHeader('Content-Disposition', 'inline');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.send(user.profile_image_data);
            return;
        }

        res.status(204).end();
    } catch (error: unknown) {
        logger.error('[File-Resolver] Profile image fetch failed', { error, userId });
        if (!res.headersSent) {
            sendError(res, 500, 'Internal Server Error');
        }
    }
};

/**
 * 🩺 HAEMI RESOLVER: Chat Attachments
 */
export const getChatAttachment = async (req: Request, res: Response): Promise<void> => {
    const { attachmentId } = req.params;
    const user = req.user as JWTPayload | undefined;

    try {
        if (!user) {
            sendError(res, 401, 'Unauthorized');
            return;
        }

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
        `, [attachmentId, user.id]);

        if (accessCheck.rows.length === 0) {
            sendError(res, 403, 'Access denied or attachment record not found');
            return;
        }

        const attachment = accessCheck.rows[0];
        const relativePath = (attachment.file_path || '').replace(/^\/+/, '').replace(/^uploads\//, '');
        
        const stats = await fileService.getFileStats(relativePath);
        if (!stats) {
            sendError(res, 404, 'Attachment file not found on server');
            return;
        }

        // 🛡️ METADATA PARITY (Institutional Sync)
        const mimeType = attachment.file_type || mime.getType(relativePath) || 'application/octet-stream';
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        
        // 🧬 EXPOSE HEADERS: Explicitly allow frontend JS to read meta
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');

        const mode = getValidatedMode(req.query.mode);
        if (mode === 'download') {
            const safeFileName = sanitizeFilename(attachment.file_name || path.basename(relativePath));
            res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
        } else {
            res.setHeader('Content-Disposition', 'inline');
        }

        const stream = fileService.getReadStream(relativePath);
        await pipeline(stream, res);
    } catch (error: unknown) {
        logger.error('[File-Resolver] Chat attachment access failure', { 
            error: error instanceof Error ? error.message : String(error), 
            attachmentId 
        });
        if (!res.headersSent) {
            sendError(res, 500, 'Internal Server Error');
        }
    }
};

/**
 * 🩺 HAEMI RESOLVER: Medical Records & Prescriptions
 */
export const getMedicalRecordFile = async (req: Request, res: Response): Promise<void> => {
    const { recordId } = req.params;
    const user = req.user as JWTPayload | undefined;

    try {
        if (!user) {
            sendError(res, 401, 'Unauthorized');
            return;
        }

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
            sendError(res, 403, 'Access denied or record not found');
            return;
        }

        const record = result.rows[0];

        // RBAC validation: Patients only see their own
        if (user.role === 'patient' && record.patient_id !== user.id) {
            sendError(res, 403, 'Unauthorized access attempt logged');
            return;
        }

        const relativePath = (record.file_path || '').replace(/^\/+/, '').replace(/^uploads\//, '');
        
        const stats = await fileService.getFileStats(relativePath);
        if (!stats) {
            sendError(res, 404, 'Clinical document not found on server');
            return;
        }

        // 🛡️ INSTITUTIONAL CLARITY
        const mimeType = record.file_mime || mime.getType(relativePath) || 'application/pdf';
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');

        const mode = getValidatedMode(req.query.mode);
        if (mode === 'download') {
            const safeFileName = sanitizeFilename(record.name || path.basename(relativePath));
            res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
        } else {
            res.setHeader('Content-Disposition', 'inline');
        }

        const stream = fileService.getReadStream(relativePath);
        await pipeline(stream, res);
    } catch (error: unknown) {
        logger.error('[File-Resolver] Clinical record fetch failure', { 
            error: error instanceof Error ? error.message : String(error), 
            recordId 
        });
        if (!res.headersSent) {
            sendError(res, 500, 'Internal Server Error');
        }
    }
};

/**
 * 🩺 HAEMI RESOLVER: Temporary Attachments
 */
export const getTempAttachment = async (req: Request, res: Response): Promise<void> => {
    const { tempId } = req.params;
    const user = req.user as JWTPayload | undefined;

    try {
        if (!user) {
            sendError(res, 401, 'Unauthorized');
            return;
        }

        const tempResult = await pool.query<{ mime: string | null, name: string }>(
            'SELECT mime, name FROM temp_attachments WHERE id::text = $1',
            [tempId]
        );

        if (tempResult.rows.length === 0) {
            logger.warn('[File-Resolver] Staged file record not found', { tempId, userId: user.id });
            sendError(res, 404, 'Temporary file record not found');
            return;
        }

        const rawMetadata = tempResult.rows[0].name;
        const tempPath = rawMetadata.includes('|') ? rawMetadata.split('|')[0] : rawMetadata;
        const relativePath = tempPath.replace(/^\/+/, '').replace(/^uploads\//, '');
        
        const stats = await fileService.getFileStats(relativePath);
        if (!stats) {
            sendError(res, 404, 'Staged file missing on server');
            return;
        }

        res.setHeader('Content-Type', tempResult.rows[0].mime || 'image/jpeg');
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');

        const mode = getValidatedMode(req.query.mode);
        if (mode === 'download') {
            const safeFileName = sanitizeFilename(tempResult.rows[0].name.split('|').pop() || 'temp_file');
            res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
        } else {
            res.setHeader('Content-Disposition', 'inline');
        }

        const stream = fileService.getReadStream(relativePath);
        await pipeline(stream, res);
    } catch (error: unknown) {
        logger.error('[File-Resolver] Temp attachment fetch failure', { 
            error: error instanceof Error ? error.message : String(error), 
            tempId 
        });
        if (!res.headersSent) {
            sendError(res, 500, 'Internal Server Error');
        }
    }
};

