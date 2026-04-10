/**
 * 🔒 HAEMI LIFE — UNIFIED FILE PIPELINE (v3.0)
 * Institutional-Grade File Lifecycle Management
 * Standard: Google/Meta Engineering Quality
 * Security: Path-traversal proof via path.util
 */

import { promises as fs, createReadStream, ReadStream } from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { getAbsolutePath, UPLOADS_ROOT } from '../utils/path.util';
import { pool } from '../config/db';
import crypto from 'crypto';

export interface FileMetadata {
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
}

class FileService {
    /**
     * 🩺 INSTITUTIONAL SAVE: Direct Buffer to Filesystem
     * Used for clinical records and profile images.
     */
    public async saveFileFromBuffer(buffer: Buffer, relativeDir: string, originalName: string): Promise<string> {
        try {
            // Institutional Entropy: UUID prefix to prevent collisions (Google/Meta Grade)
            const entropy = crypto.randomUUID().split('-')[0];
            const safeName = originalName.replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
            const fileName = `${Date.now()}_${entropy}_${safeName}`;
            const relativePath = path.join(relativeDir, fileName);
            const fullPath = getAbsolutePath(relativePath);

            // Ensure directory exists
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            
            // Asynchronous write (Non-blocking)
            await fs.writeFile(fullPath, buffer);
            
            logger.info('[FileService] File saved successfully', { relativePath, size: buffer.length });
            return relativePath.replace(/\\/g, '/'); // Force forward slashes for DB consistency
        } catch (error: unknown) {
            logger.error('[FileService] saveFileFromBuffer Failure:', {
                error: error instanceof Error ? error.message : String(error),
                originalName
            });
            throw error;
        }
    }

    /**
     * 🩺 INSTITUTIONAL MOVE: Staging to Vault (Atomic-Like Transition)
     * Moves a temporary chat attachment to the permanent vault.
     */
    public async moveStagedFile(tempId: string, targetDir: string): Promise<FileMetadata | null> {
        try {
            // Institutional Standard: Fetch naming metadata from DB (Source of Truth)
            const tempResult = await pool.query<{ mime: string | null, name: string }>(
                'SELECT mime, name FROM temp_attachments WHERE id::text = $1',
                [tempId]
            );

            if (tempResult.rows.length === 0) {
                logger.warn('[FileService] Attempted to move non-existent staging record', { tempId });
                return null;
            }

            const stagingMetadata = tempResult.rows[0].name;
            const [tempRelativePath, originalName] = stagingMetadata.includes('|') 
                ? stagingMetadata.split('|') 
                : [stagingMetadata, path.basename(stagingMetadata)];

            const fileName = `${Date.now()}_${originalName.replace(/\s+/g, '_')}`;
            const permanentRelativePath = path.join(targetDir, fileName);
            
            const fullTempPath = getAbsolutePath(tempRelativePath);
            const fullPermanentPath = getAbsolutePath(permanentRelativePath);

            // Access check & directory preparation
            await fs.access(fullTempPath);
            await fs.mkdir(path.dirname(fullPermanentPath), { recursive: true });

            // Institutional Move: Cross-partition safe (Copy + Unlink)
            // Fixes potential crashes when uploads/temp and vault are on different volumes
            await fs.copyFile(fullTempPath, fullPermanentPath);
            await fs.unlink(fullTempPath);
            
            const stats = await fs.stat(fullPermanentPath);
            
            logger.info('[FileService] Staged file promoted to Vault', { tempId, permanentRelativePath });

            return {
                fileName: originalName,
                filePath: permanentRelativePath.replace(/\\/g, '/'),
                fileSize: stats.size,
                mimeType: tempResult.rows[0].mime || 'application/octet-stream'
            };
        } catch (error: unknown) {
            // INSTITUTIONAL RECOVERY: Check for ENOENT (File Not Found)
            // Architecture: Resolves race conditions between staged uploads and message delivery.
            if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
                logger.warn('[FileService] Staged attachment physical file missing (Graceful Skip)', { tempId });
                return null;
            }

            logger.error('[FileService] moveStagedFile Systemic Failure:', {
                error: error instanceof Error ? error.message : String(error),
                tempId
            });
            throw error;
        }
    }

    /**
     * 🩺 INSTITUTIONAL QUARANTINE: Forensic Preservation
     * Instead of unlinking, moves files to a secure quarantine zone.
     * Path: uploads/_quarantine/YYYY-MM-DD/filename
     */
    public async quarantineFile(relativePath: string): Promise<string | null> {
        try {
            if (!relativePath || relativePath === 'DB_ONLY') return null;
            
            const fullPath = getAbsolutePath(relativePath);
            const dateDir = new Date().toISOString().split('T')[0];
            const quarantineRelativeDir = path.join('_quarantine', dateDir);
            const quarantineFullPath = getAbsolutePath(path.join(quarantineRelativeDir, path.basename(relativePath)));

            // Ensure quarantine directory exists
            await fs.mkdir(path.dirname(quarantineFullPath), { recursive: true });

            // Institutional Move: Cross-partition safe (Copy + Unlink)
            await fs.copyFile(fullPath, quarantineFullPath);
            await fs.unlink(fullPath);
            
            const auditPath = path.join(quarantineRelativeDir, path.basename(relativePath)).replace(/\\/g, '/');
            logger.info('[FileService] File moved to quarantine for forensic audit', { 
                original: relativePath, 
                quarantine: auditPath 
            });
            
            return auditPath;
        } catch (error: unknown) {
            logger.error('[FileService] quarantineFile Failure:', {
                error: error instanceof Error ? error.message : String(error),
                relativePath
            });
            return null;
        }
    }

    /**
     * 🩺 INSTITUTIONAL DELETE: Zero-Ghost Removal
     * Permanently unlinks a physical file. Safe-locked to UPLOADS_ROOT.
     */
    public async deletePhysicalFile(relativePath: string): Promise<boolean> {
        try {
            if (!relativePath || relativePath === 'DB_ONLY') return false;
            
            const fullPath = getAbsolutePath(relativePath);
            
            // Critical Security Check: Ensure we never cross UPLOADS_ROOT
            if (!fullPath.startsWith(UPLOADS_ROOT)) {
                logger.warn('[FileService] Security Bypass attempt in deletion blocked', { relativePath });
                return false;
            }

            // Check existence before delete to avoid noisy ENOENT errors
            try {
                await fs.access(fullPath);
                await fs.unlink(fullPath);
                logger.info('[FileService] Ghost file purged', { relativePath });
                return true;
            } catch (error: unknown) {
                logger.warn('[FileService] Attempted to purge missing file (Graceful)', { 
                    relativePath,
                    error: error instanceof Error ? error.message : String(error)
                });
                return false;
            }
        } catch (error: unknown) {
            logger.error('[FileService] deletePhysicalFile Failure:', {
                error: error instanceof Error ? error.message : String(error),
                relativePath
            });
            return false;
        }
    }

    /**
     * 🩺 INSTITUTIONAL STREAM: Deterministic ReadStream Provider
     */
    public getReadStream(relativePath: string): ReadStream {
        const fullPath = getAbsolutePath(relativePath);
        return createReadStream(fullPath);
    }

    /**
     * 🩺 INSTITUTIONAL PRE-FLIGHT: Statutory existence & metadata check
     * Architecture: Resolves race conditions between headers and data streams.
     */
    public async getFileStats(relativePath: string): Promise<{ size: number, mtime: Date } | null> {
        try {
            const fullPath = getAbsolutePath(relativePath);
            const stats = await fs.stat(fullPath);
            return {
                size: stats.size,
                mtime: stats.mtime
            };
        } catch (error: unknown) {
            // Institutional Quiet Reject: Return null if file doesn't exist on disk
            // Logic: Logged as debug info to maintain zero-noise audit trails.
            logger.debug('[FileService] Pre-flight stat check failed (Normal if file missing)', {
                path: relativePath,
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }
}

export const fileService = new FileService();
