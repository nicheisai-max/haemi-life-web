// 🔒 HAEMI ATTACHMENT PIPELINE LOCK
// DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL
// SINGLE SOURCE: message_attachments ONLY
// FALLBACKS FORBIDDEN
// TYPESCRIPT STRICT MODE ENFORCED

import { Request, Response } from 'express';
import { pool } from '../config/db';
import { JWTPayload } from '../types/express';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';
import mime from 'mime';
import { getAbsolutePath, UPLOADS_ROOT } from '../utils/path.util';

/**
 * 🩺 HAEMI LIFE — INSTITUTIONAL FILE CONTROLLER
 * Path Resolution: Deterministic (via __dirname)
 * Security: Path-traversal proof + Token-validated
 */

// Centralized path resolution for absolute reliability — NOW IMPORTED FROM path.util.ts

// ... [getProfileImage remains unchanged - but adding the lock comment at top if it was at top]
// Wait, I should include the whole file or just the middle part? 
// The tool says "replace a single contiguous block".
// I'll replace from the top to the end of getChatAttachment.

// [Reprinting getProfileImage for context and to include the lock at the top]
export const getProfileImage = async (req: Request, res: Response) => {
    const userId = req.params.userId as string;

    try {
        // Use profile_image column but resolve to deterministic filesystem path
        let query = 'SELECT profile_image_data, profile_image_mime, profile_image FROM users WHERE id = $1';
        let params = [userId];

        if (userId.includes('.') || userId.startsWith('profile-')) {
            query = 'SELECT profile_image_data, profile_image_mime, profile_image FROM users WHERE profile_image LIKE $1 OR profile_image = $2';
            params = [`%${userId}`, userId];
        }

        const result = await pool.query<{
            profile_image_data: Buffer | null,
            profile_image_mime: string | null,
            profile_image: string | null
        }>(query, params);

        if (result.rows.length === 0) {
            return sendError(res, 404, 'User/Image not found');
        }

        const user = result.rows[0];

        // 1. Check for Filesystem path (Priority)
        if (user.profile_image && !user.profile_image.startsWith('/api/')) {
            const relativePath = user.profile_image
              .replace(/^\/+/, '')
              .replace(/^uploads\//, '');
            const fullPath = getAbsolutePath(relativePath);
            
            // Path Traversal Protection (Staff Engineer Grade)
            if (!fullPath.startsWith(UPLOADS_ROOT)) {
                logger.warn('[File-Auth] Restricted path access attempt blocked', { userId, path: fullPath });
                return sendError(res, 403, 'Restricted path');
            }

            if (fs.existsSync(fullPath)) {
                const detectedMime = mime.getType(fullPath) || user.profile_image_mime || 'image/jpeg';
                res.setHeader('Content-Type', detectedMime);
                res.setHeader('Content-Disposition', `inline; filename="profile-${userId}${path.extname(user.profile_image)}"`);
                res.setHeader('Cache-Control', 'public, max-age=3600');
                
                const stream = fs.createReadStream(fullPath);
                stream.on('error', (err) => {
                    logger.error('Stream error during profile fetch:', { error: err.message, userId });
                    if (!res.headersSent) {
                        res.status(500).json({ success: false, message: 'Internal Server Error' });
                    }
                });
                return stream.pipe(res);
            } else {
                logger.error("FILE NOT FOUND (PROFILE):", { fullPath, userId });
                return sendError(res, 404, 'Profile image file not found on server');
            }
        }

        // 2. Fallback to Redirect if it's a legacy external URL
        if (user.profile_image && user.profile_image.startsWith('http')) {
            return res.redirect(user.profile_image);
        }

        return sendError(res, 404, 'Profile image not found');
    } catch (error: unknown) {
        logger.error('Forensic Error: Fetching profile image failed', { 
            error: error instanceof Error ? error.message : String(error),
            userId 
        });
        return sendError(res, 500, 'Internal Server Error');
    }
};

export const getChatAttachment = async (req: Request, res: Response) => {
    const { messageId } = req.params; // This works as a generic ID (Message UUID or Attachment UUID)
    const user = req.user as JWTPayload | undefined;

    try {
        if (!user) return sendError(res, 401, 'Unauthorized');

        // 🔒 HAEMI LIFE — CRITICAL DOWNLOAD PIPELINE LOCK
        // ⚠️ DO NOT MODIFY THIS BLOCK WITHOUT EXPLICIT USER APPROVAL
        // SINGLE SOURCE: message_attachments ONLY
        // NO FALLBACKS to messages.attachment_url allowed.

        const accessCheck = await pool.query<{
            file_url: string,
            file_type: string | null,
            file_name: string | null
        }>(`
            SELECT ma.file_url, ma.file_type, ma.file_name
            FROM message_attachments ma
            JOIN messages m ON ma.message_id = m.id
            JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
            WHERE (ma.id = $1 OR m.id = $1) AND cp.user_id = $2
            LIMIT 1
        `, [messageId, user.id]);

        if (accessCheck.rows.length === 0) {
            return sendError(res, 403, 'Access denied or attachment record not found');
        }

        const attachment = accessCheck.rows[0];

        if (!attachment.file_url) {
            return sendError(res, 404, 'No file reference exists for this attachment');
        }

        const relativePath = attachment.file_url
            .replace(/^\/+/, '')
            .replace(/^uploads\//, '');
        const fullPath = getAbsolutePath(relativePath);

        // Strict Path Traversal Protection
        if (!fullPath.startsWith(UPLOADS_ROOT)) {
            logger.error('[Lock-Security] Path traversal attempt detected', { fullPath, messageId });
            return sendError(res, 403, 'Restricted path');
        }

        // Hard Lock: Verify physical existence before any response headers
        if (!fs.existsSync(fullPath)) {
            logger.error('[Lock-Integrity] Physical file missing for valid DB reference', { fullPath, messageId });
            return sendError(res, 404, 'Physical file not found on server');
        }

        const detectedMime = mime.getType(fullPath) || attachment.file_type || 'application/octet-stream';
        res.setHeader('Content-Type', detectedMime);
        const safeFileName = attachment.file_name || path.basename(fullPath);
        res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
        
        const stream = fs.createReadStream(fullPath);
        stream.on('error', (err) => {
            logger.error('Stream error during attachment fetch:', { error: err.message, messageId, userId: user.id });
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: 'Internal Server Error' });
            }
        });
        return stream.pipe(res);
    } catch (error: unknown) {
        logger.error('Forensic Error: Fetching chat attachment failed', { 
            error: error instanceof Error ? error.message : String(error),
            messageId,
            userId: user?.id 
        });
        return sendError(res, 500, 'Internal Server Error');
    }
};

export const getMedicalRecordFile = async (req: Request, res: Response) => {
    const { recordId } = req.params;
    const user = req.user as JWTPayload | undefined;

    try {
        if (!user) return sendError(res, 401, 'Unauthorized');

        // P0 FIX: Hardened Query — ALWAYS prioritize valid token session
        let query = `
            SELECT name, file_data, file_mime, file_path 
            FROM medical_records 
            WHERE id = $1 AND deleted_at IS NULL
        `;
        const params: (string | number)[] = [recordId as string];

        // RBAC validation: Admins/Doctors bypass ownership check; patients restricted to own
        if (user.role === 'patient') {
            query += ' AND patient_id = $2';
            params.push(user.id);
        }

        const result = await pool.query<{
            name: string,
            file_data: Buffer | null,
            file_mime: string | null,
            file_path: string | null
        }>(query, params);

        if (result.rows.length === 0) {
            logger.warn('[File-Auth] Access Blocked: Unauthorized record access attempt', { recordId, userId: user.id });
            return sendError(res, 403, 'Access denied or record not found');
        }

        const record = result.rows[0];

        if (record.file_path && record.file_path !== 'DB_ONLY') {
            let actualPath = record.file_path;
            let actualMime = record.file_mime;
            let actualName = record.name;

            // P0 FIX: Institutional Multi-File Resolution
            if (record.file_path === 'MULTI_FILE') {
                const subFiles = await pool.query<{
                    file_path: string,
                    file_mime: string | null,
                    file_name: string | null
                }>(
                    'SELECT file_path, file_mime, file_name FROM medical_record_files WHERE record_id = $1 LIMIT 1',
                    [recordId]
                );

                if (subFiles.rows.length === 0) {
                    logger.error('[File-Auth] MULTI_FILE record has no associated entries', { recordId });
                    return sendError(res, 404, 'Multi-file record entries not found');
                }

                actualPath = subFiles.rows[0].file_path;
                actualMime = subFiles.rows[0].file_mime;
                actualName = subFiles.rows[0].file_name || record.name;
            }

            const relativePath = actualPath
              .replace(/^\/+/, '')
              .replace(/^uploads\//, '');
            const fullPath = getAbsolutePath(relativePath);

            if (!fullPath.startsWith(UPLOADS_ROOT)) {
                return sendError(res, 403, 'Restricted path');
            }

            if (fs.existsSync(fullPath)) {
                const detectedMime = mime.getType(fullPath) || actualMime || 'application/octet-stream';
                res.setHeader('Content-Type', detectedMime);
                const safeFileName = actualName || path.basename(fullPath);
                res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
                
                const stream = fs.createReadStream(fullPath);
                stream.on('error', (err) => {
                    logger.error('Stream error during record fetch:', { error: err.message, recordId, userId: user.id });
                    if (!res.headersSent) {
                        res.status(500).json({ success: false, message: 'Internal Server Error' });
                    }
                });
                return stream.pipe(res);
            } else {
                logger.error("FILE NOT FOUND (RECORD):", { fullPath, recordId, userId: user.id });
                return sendError(res, 404, 'Medical record file not found on server');
            }
        }

        return sendError(res, 404, 'Record file not found');
    } catch (error: unknown) {
        logger.error('Forensic Error: Fetching medical record failed', { 
            error: error instanceof Error ? error.message : String(error),
            recordId,
            userId: user?.id 
        });
        return sendError(res, 500, 'Internal Server Error');
    }
};

export const getTempAttachment = async (req: Request, res: Response) => {
    const { tempId } = req.params;
    const user = req.user as JWTPayload | undefined;

    try {
        if (!user) return sendError(res, 401, 'Unauthorized');

        const result = await pool.query<{
            mime: string | null,
            name: string
        }>(
            'SELECT mime, name FROM temp_attachments WHERE id = $1',
            [tempId]
        );

        if (result.rows.length === 0) {
            return sendError(res, 404, 'Temporary attachment not found');
        }

        const { mime: attachmentMime, name: relativePath } = result.rows[0];
        
        // Resolve using same logic as chat.controller.ts
        const fullPath = getAbsolutePath(relativePath);

        const tempRoot = getAbsolutePath('chat/temp');
        if (!fullPath.startsWith(tempRoot)) {
            logger.warn('[File-Auth] Restricted path access attempt blocked (temp)', { userId: user.id, path: fullPath });
            return sendError(res, 403, 'Restricted path');
        }

        if (fs.existsSync(fullPath)) {
            const detectedMime = mime.getType(fullPath) || attachmentMime || 'application/octet-stream';
            res.setHeader('Content-Type', detectedMime);
            res.setHeader('Content-Disposition', `inline; filename="${path.basename(fullPath)}"`);
            
            const stream = fs.createReadStream(fullPath);
            stream.on('error', (err) => {
                logger.error('Stream error during temp attachment fetch:', { error: err.message, tempId, userId: user.id });
                if (!res.headersSent) {
                    res.status(500).json({ success: false, message: 'Internal Server Error' });
                }
            });
            return stream.pipe(res);
        } else {
            logger.error("FILE NOT FOUND (TEMP ATTACHMENT):", { fullPath, tempId, userId: user.id });
            return sendError(res, 404, 'Temporary file not found on server');
        }
    } catch (error: unknown) {
        logger.error('Forensic Error: Fetching temp attachment failed', { 
            error: error instanceof Error ? error.message : String(error),
            tempId,
            userId: user?.id 
        });
        return sendError(res, 500, 'Internal Server Error');
    }
};
