/**
 * 🔒 HAEMI LIFE — UNIFIED FILE PIPELINE (v4.0)
 * Institutional-Grade File Lifecycle Management
 * Standard: Google/Meta Engineering Quality (Zero-Drift Architecture)
 * Security: Path-traversal proof via path.util & Domain Silos
 */

import { promises as fs, createReadStream, ReadStream } from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { getAbsolutePath, UPLOADS_ROOT } from '../utils/path.util';
import { pool } from '../config/db';
import crypto from 'crypto';
import { FileDomain, FileMetadata, AttachmentId } from '../types/file';

class FileService {
    /**
     * 🧬 DOMAIN PATH RESOLVER
     * Ensures all institutional assets are siloed correctly.
     */
    private getDomainDir(domain: FileDomain): string {
        switch (domain) {
            case FileDomain.CHAT: return 'chat';
            case FileDomain.CHAT_TEMP: return 'chat/temp';
            case FileDomain.CLINICAL:
            case FileDomain.MEDICAL_RECORDS: return 'medical_records';
            case FileDomain.PROFILE: return 'profiles';
            case FileDomain.SYSTEM: return 'system';
            default: return 'misc';
        }
    }

    /**
     * 🩺 INSTITUTIONAL SAVE: Direct Buffer to Filesystem
     * Protocol: Write -> FSync -> Commit
     */
    public async saveFileFromBuffer(
        buffer: Buffer, 
        domain: FileDomain, 
        originalName: string
    ): Promise<string> {
        const correlationId = crypto.randomUUID();
        try {
            const domainDir = this.getDomainDir(domain);
            const entropy = crypto.randomUUID().split('-')[0];
            const safeName = originalName.replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
            const fileName = `${Date.now()}_${entropy}_${safeName}`;
            const relativePath = path.join(domainDir, fileName);
            const fullPath = getAbsolutePath(relativePath);

            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            
            // P0: Persistence Durability (Google/Meta Standard)
            const handle = await fs.open(fullPath, 'w');
            await handle.writeFile(buffer);
            await handle.sync(); // Force hardware flush
            await handle.close();
            
            logger.info('[FileService] Enterprise save successful', { 
                relativePath, 
                size: buffer.length,
                domain,
                correlationId 
            });
            
            return relativePath.replace(/\\/g, '/');
        } catch (error: unknown) {
            logger.error('[FileService] saveFileFromBuffer Failure:', {
                error: error instanceof Error ? error.message : String(error),
                originalName,
                correlationId
            });
            throw error;
        }
    }

    /**
     * 🧬 ATOMIC MOVE PROTOCOL (Zero-Ghost Engine)
     * Cross-partition safe: Copy -> FSync -> Atomic Rename
     */
    private async atomicMove(source: string, destination: string): Promise<void> {
        const tempDest = `${destination}.tmp_${crypto.randomBytes(4).toString('hex')}`;
        
        // 1. Copy to temporary location on destination target
        await fs.copyFile(source, tempDest);
        
        // 2. Ensure data is flushed to physical media
        const handle = await fs.open(tempDest, 'r+');
        await handle.sync();
        await handle.close();
        
        // 3. Atomic Rename (POSIX replacement)
        await fs.rename(tempDest, destination);
        
        // 4. Cleanup source
        await fs.unlink(source);
    }

    /**
     * 🩺 INSTITUTIONAL PROMOTION: Staging to Vault
     * Moves a temporary chat attachment to the permanent domain vault.
     */
    public async moveStagedFile(
        tempId: string, 
        domain: FileDomain = FileDomain.CHAT
    ): Promise<FileMetadata | null> {
        const correlationId = crypto.randomUUID();
        try {
            const tempResult = await pool.query<{ mime: string | null, name: string, id: string }>(
                'SELECT id, mime, name FROM temp_attachments WHERE id::text = $1',
                [tempId]
            );

            if (tempResult.rows.length === 0) {
                logger.warn('[FileService] Move blocked: Staging record not found', { tempId, correlationId });
                return null;
            }

            const stagingMetadata = tempResult.rows[0].name;
            const [tempRelativePath, originalName] = stagingMetadata.includes('|') 
                ? stagingMetadata.split('|') 
                : [stagingMetadata, path.basename(stagingMetadata)];

            const targetDir = this.getDomainDir(domain);
            const fileName = `${Date.now()}_${originalName.replace(/\s+/g, '_')}`;
            const permanentRelativePath = path.join(targetDir, fileName);
            
            const fullTempPath = getAbsolutePath(tempRelativePath);
            const fullPermanentPath = getAbsolutePath(permanentRelativePath);

            await fs.access(fullTempPath);
            await fs.mkdir(path.dirname(fullPermanentPath), { recursive: true });

            // Trigger Atomic Promotion
            await this.atomicMove(fullTempPath, fullPermanentPath);
            
            // P1: ZERO-GHOST VERIFICATION (Google/Meta Standard)
            // Ensure the physical asset is definitively written to the vault before committing to DB
            await fs.access(fullPermanentPath);
            const stats = await fs.stat(fullPermanentPath);
            
            if (stats.size === 0) {
                logger.error('[Security] Blocked promotion of 0-byte ghost asset from staging', {
                    tempId,
                    permanentRelativePath,
                    correlationId
                });
                throw new Error('CORRUPT_STAGED_ASSET_ZERO_BYTE');
            }

            logger.info('[FileService] Staged file promoted to Vault (Verified)', { 
                tempId, 
                permanentRelativePath,
                size: stats.size,
                correlationId 
            });

            return {
                id: tempResult.rows[0].id as AttachmentId,
                domain: domain,
                fileName: originalName,
                filePath: permanentRelativePath.replace(/\\/g, '/'),
                mimeType: tempResult.rows[0].mime || 'application/octet-stream',
                fileSize: stats.size,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        } catch (error: unknown) {
            if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
                logger.warn('[FileService] Staged asset missing (Ghost during promotion)', { tempId, correlationId });
                return null;
            }

            logger.error('[FileService] moveStagedFile Systemic Failure:', {
                error: error instanceof Error ? error.message : String(error),
                tempId,
                correlationId
            });
            throw error;
        }
    }

    /**
     * 🩺 INSTITUTIONAL DELETE: Zero-Ghost Removal
     */
    public async deletePhysicalFile(relativePath: string): Promise<boolean> {
        try {
            if (!relativePath || relativePath === 'DB_ONLY') return false;
            const fullPath = getAbsolutePath(relativePath);
            
            if (!fullPath.startsWith(UPLOADS_ROOT)) {
                logger.warn('[FileService] Security: Deletion escape blocked', { relativePath });
                return false;
            }

            try {
                await fs.access(fullPath);
                await fs.unlink(fullPath);
                logger.info('[FileService] Asset purged from storage', { relativePath });
                return true;
            } catch {
                return false;
            }
        } catch (error: unknown) {
            logger.error('[FileService] deletePhysicalFile Failure:', { error, relativePath });
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
     * 🩺 INSTITUTIONAL PRE-FLIGHT: Metadata integrity check
     */
    public async getFileStats(relativePath: string): Promise<{ size: number, mtime: Date } | null> {
        try {
            const fullPath = getAbsolutePath(relativePath);
            const stats = await fs.stat(fullPath);
            return {
                size: stats.size,
                mtime: stats.mtime
            };
        } catch {
            logger.debug('[FileService] Stat pre-flight missed', { path: relativePath });
            return null;
        }
    }

    /**
     * 🩺 FORENSIC QUARANTINE
     */
    public async quarantineFile(relativePath: string): Promise<string | null> {
        try {
            if (!relativePath || relativePath === 'DB_ONLY') return null;
            const fullPath = getAbsolutePath(relativePath);
            const quarantineRelativeDir = path.join('_quarantine', new Date().toISOString().split('T')[0]);
            const quarantineFullPath = getAbsolutePath(path.join(quarantineRelativeDir, path.basename(relativePath)));

            await fs.mkdir(path.dirname(quarantineFullPath), { recursive: true });
            await this.atomicMove(fullPath, quarantineFullPath);
            
            return path.join(quarantineRelativeDir, path.basename(relativePath)).replace(/\\/g, '/');
        } catch (error: unknown) {
            logger.error('[FileService] quarantineFile Failure:', { error, relativePath });
            return null;
        }
    }
}

export const fileService = new FileService();
