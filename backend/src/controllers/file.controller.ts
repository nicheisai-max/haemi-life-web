/**
 * 🩺 HAEMI LIFE — INSTITUTIONAL FILE DELIVERY SYSTEM (v6.0)
 * Standard: Google/Meta Strict Type Parity & Zero-Drift Metadata
 * Protocol: Verified Binary Tunneling with Domain-Aware RBAC
 */

import { Request, Response } from 'express';
import { pool } from '../config/db';
import { JWTPayload } from '../types/express';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';
import * as path from 'path';
import mime from 'mime';
import { fileService } from '../services/file.service';
import { pipeline } from 'stream/promises';
import { FileDomain } from '../types/file';

/**
 * 🛡️ INSTITUTIONAL FILENAME SANITIZER
 */
function sanitizeFilename(filename: string): string {
    return filename
        .replace(/["';\r\n]/g, '')
        .replace(/[^\x20-\x7E]/g, '_')
        .trim() || 'haemi_clinical_file';
}

function getValidatedMode(mode: unknown): 'preview' | 'download' {
    return mode === 'download' ? 'download' : 'preview';
}

/**
 * 🧬 UNIFIED STREAM RESOLVER
 * Google/Meta Grade: Centralized header management and stream lifecycle.
 */
async function deliverFile(
    res: Response,
    relativePath: string,
    metadata: { name: string; mimeType?: string; domain: FileDomain },
    mode: 'preview' | 'download' = 'preview'
): Promise<void> {
    try {
        const stats = await fileService.getFileStats(relativePath);
        if (!stats) {
            logger.warn('[File-Resolver] Physical asset missing during delivery', { relativePath, domain: metadata.domain });
            sendError(res, 404, 'Asset not found on storage media');
            return;
        }

        // 🛡️ ZERO-BYTE INTEGRITY GATE (Absolute Ghost Prevention)
        if (stats.size === 0) {
            logger.error('[Security] Blocked delivery of 0-byte ghost asset', { relativePath, domain: metadata.domain });
            sendError(res, 404, 'Asset corruption detected: Zero-length file');
            return;
        }

        // P0: Infrastructure Headers
        res.setHeader('Content-Type', metadata.mimeType || mime.getType(relativePath) || 'application/octet-stream');
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');

        if (mode === 'download') {
            const safeFileName = sanitizeFilename(metadata.name || path.basename(relativePath));
            res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
        } else {
            res.setHeader('Content-Disposition', 'inline');
        }

        const stream = fileService.getReadStream(relativePath);
        await pipeline(stream, res);
    } catch (error: unknown) {
        logger.error('[File-Resolver] Stream pipeline collapsed', { 
            error: error instanceof Error ? error.message : String(error),
            relativePath 
        });
        if (!res.headersSent) {
            sendError(res, 500, 'Internal delivery engine failure');
        }
    }
}

/**
 * 🩺 RESOLVER: Profile Image
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
            sendError(res, 404, 'User identity not found');
            return;
        }

        const user = result.rows[0];

        if (user.profile_image && user.profile_image.startsWith('http')) {
            res.redirect(user.profile_image);
            return;
        }

        if (user.profile_image && !user.profile_image.startsWith('/api/')) {
            const relativePath = user.profile_image.replace(/^(\/)?uploads\//i, '').replace(/^\/+/, '');
            await deliverFile(res, relativePath, { 
                name: `profile_${userId}`, 
                mimeType: user.profile_image_mime || undefined,
                domain: FileDomain.PROFILE 
            });
            return;
        }

        if (user.profile_image_data) {
            res.setHeader('Content-Type', user.profile_image_mime || 'image/jpeg');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.send(user.profile_image_data);
            return;
        }

        res.status(204).end();
    } catch (error: unknown) {
        logger.error('[File-Resolver] Profile resolution failure', { error, userId });
        sendError(res, 500, 'Profile engine error');
    }
};

/**
 * 🩺 RESOLVER: Chat Attachments
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
            sendError(res, 403, 'RBAC Denied: Attachment access restricted');
            return;
        }

        const attachment = accessCheck.rows[0];
        const relativePath = (attachment.file_path || '').replace(/^\/+/, '').replace(/^uploads\//, '');
        const mode = getValidatedMode(req.query.mode);

        await deliverFile(res, relativePath, {
            name: attachment.file_name || 'chat_attachment',
            mimeType: attachment.file_type || undefined,
            domain: FileDomain.CHAT
        }, mode);
    } catch (error: unknown) {
        logger.error('[File-Resolver] Chat access failure', { error, attachmentId });
        sendError(res, 500, 'Messaging file engine failure');
    }
};

/**
 * 🩺 RESOLVER: Medical Records & Prescriptions
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
            sendError(res, 404, 'Clinical record not found');
            return;
        }

        const record = result.rows[0];

        // Strict RBAC: Clinical Isolation
        if (user.role === 'patient' && record.patient_id !== user.id) {
            logger.warn('[Security] Unauthorized clinical access attempt', { recordId, userId: user.id });
            sendError(res, 403, 'Access denied: Patient isolation active');
            return;
        }

        const relativePath = (record.file_path || '').replace(/^\/+/, '').replace(/^uploads\//, '');
        const mode = getValidatedMode(req.query.mode);

        await deliverFile(res, relativePath, {
            name: record.name,
            mimeType: record.file_mime || undefined,
            domain: FileDomain.CLINICAL
        }, mode);
    } catch (error: unknown) {
        logger.error('[File-Resolver] Clinical document failure', { error, recordId });
        sendError(res, 500, 'Clinical engine failure');
    }
};

/**
 * 🩺 RESOLVER: Temporary Attachments
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
            sendError(res, 404, 'Staged record expired or missing');
            return;
        }

        const rawMetadata = tempResult.rows[0].name;
        const tempPath = rawMetadata.includes('|') ? rawMetadata.split('|')[0] : rawMetadata;
        const relativePath = tempPath.replace(/^\/+/, '').replace(/^uploads\//, '');
        const mode = getValidatedMode(req.query.mode);

        await deliverFile(res, relativePath, {
            name: tempResult.rows[0].name.split('|').pop() || 'temp_file',
            mimeType: tempResult.rows[0].mime || undefined,
            domain: FileDomain.CHAT
        }, mode);
    } catch (error: unknown) {
        logger.error('[File-Resolver] Staging resolution failure', { error, tempId });
        sendError(res, 500, 'Staging engine failure');
    }
};
