import { pool } from '../config/db';
import { fileService } from './file.service';
import { logger } from '../utils/logger';
import { promises as fs } from 'fs';
import * as path from 'path';
import { UPLOADS_ROOT } from '../utils/path.util';

/**
 * 🩺 HAEMI LIFE — FORENSIC CLEANUP SERVICE (v6.0)
 * Institutional Utility: Identifies and purges abandoned "Ghost Files" 
 * from the chat staging area (uploads/chat/temp) and orphaned assets in vault.
 * Now includes Meta-Grade 'Zombie Session' Reaper.
 */

class CleanupService {
    private isRunning = false;

    /**
     * 🕵️‍♂️ PURGE ORPHANED PHYSICAL ASSETS
     * Scans the institutional uploads directory and purges files
     * that have no corresponding record in the database.
     * Aligned with Investor Demo 'Zero-Ghost' requirement.
     */
    public async purgeOrphanedAssets(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;

        const client = await pool.connect();
        try {
            logger.info('[CleanupService] Starting deep forensic scan for orphaned assets...');

            // 1. Collect all valid paths from the Source of Truth (Database)
            const [
                attachments,
                records,
                prescriptions,
                profiles
            ] = await Promise.all([
                client.query<{ file_path: string }>('SELECT file_path FROM message_attachments WHERE deleted_at IS NULL'),
                client.query<{ file_path: string }>('SELECT file_path FROM medical_records WHERE deleted_at IS NULL'),
                client.query<{ file_path: string }>('SELECT file_path FROM prescription_files'),
                client.query<{ profile_image: string }>('SELECT profile_image FROM users WHERE profile_image IS NOT NULL')
            ]);

            const validPaths = new Set<string>();
            const addPath = (p: string | null) => {
                if (!p || p === 'DB_ONLY' || p.startsWith('http')) return;
                // Normalize path to match filesystem (strip /api/ profiles prefix if present)
                const normalized = p.replace(/^(\/)?(uploads\/)?/i, '').replace(/\\/g, '/');
                if (normalized) validPaths.add(normalized);
            };

            attachments.rows.forEach(r => addPath(r.file_path));
            records.rows.forEach(r => addPath(r.file_path));
            prescriptions.rows.forEach(r => addPath(r.file_path));
            profiles.rows.forEach(r => addPath(r.profile_image));

            logger.info(`[CleanupService] Identified ${validPaths.size} active clinical assets in DB.`);

            // 2. Recursive Scan of Uploads Directory
            const orphanedFiles: string[] = [];
            const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

            const walk = async (dir: string) => {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.resolve(dir, entry.name);
                    if (entry.isDirectory()) {
                        // Skip system folders and quarantine
                        if (entry.name !== '_quarantine' && entry.name !== 'temp') { 
                            await walk(fullPath);
                        }
                    } else {
                        const stats = await fs.stat(fullPath);
                        // Institutional Safety: Skip files modified in the last 5 minutes
                        if (stats.mtimeMs > fiveMinutesAgo) continue;

                        const relativePath = path.relative(UPLOADS_ROOT, fullPath).replace(/\\/g, '/');
                        if (!validPaths.has(relativePath)) {
                            orphanedFiles.push(relativePath);
                        }
                    }
                }
            };

            try {
                await fs.access(UPLOADS_ROOT);
                await walk(UPLOADS_ROOT);
            } catch (error: unknown) {
                logger.warn('[CleanupService] Uploads directory missing or inaccessible during scan.', {
                    error: error instanceof Error ? error.message : String(error)
                });
                return;
            }

            if (orphanedFiles.length === 0) {
                logger.info('[CleanupService] Zero orphaned assets detected. Infrastructure is clean.');
                return;
            }

            logger.info(`[CleanupService] Identified ${orphanedFiles.length} orphaned files for purging.`);

            // 3. Purge Orphaned Files
            for (const file of orphanedFiles) {
                try {
                    await fileService.deletePhysicalFile(file);
                    logger.debug(`[CleanupService] Purged orphaned asset: ${file}`);
                } catch (err) {
                    logger.error(`[CleanupService] Failed to purge orphaned file: ${file}`, { 
                        error: err instanceof Error ? err.message : String(err) 
                    });
                }
            }

            logger.info('[CleanupService] Orphaned asset purge cycle completed.');
        } catch (error) {
            logger.error('[CleanupService] Critical failure during orphaned asset scan:', {
                error: error instanceof Error ? error.message : String(error)
            });
        } finally {
            this.isRunning = false;
            client.release();
        }
    }

    /**
     * 🗑️ PURGE ABANDONED STAGING ASSETS
     * Deletes temp_attachments records and physical files older than 24 hours.
     */
    public async purgeAbandonedStaging(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;

        const client = await pool.connect();
        try {
            logger.info('[CleanupService] Starting forensic purge of abandoned staging assets...');

            // Institutional Standard: 24-hour expiration for un-promoted staging files
            const result = await client.query<{ id: string, name: string }>(
                `SELECT id, name FROM temp_attachments 
                 WHERE (created_at < NOW() - INTERVAL '24 hours')`
            );

            if (result.rows.length === 0) {
                logger.info('[CleanupService] No abandoned assets detected.');
                return;
            }

            logger.info(`[CleanupService] Identified ${result.rows.length} ghost assets for purging.`);

            for (const row of result.rows) {
                try {
                    const stagingMetadata = row.name;
                    // Extract path from "path|originalname" format
                    const relativePath = stagingMetadata.includes('|') 
                        ? stagingMetadata.split('|')[0] 
                        : stagingMetadata;

                    // Physical Purge
                    await fileService.deletePhysicalFile(relativePath);

                    // Database Purge
                    await client.query('DELETE FROM temp_attachments WHERE id = $1', [row.id]);
                } catch (rowErr) {
                    logger.error(`[CleanupService] Failed to purge individual asset ID ${row.id}:`, {
                        error: rowErr instanceof Error ? rowErr.message : String(rowErr)
                    });
                }
            }

            logger.info('[CleanupService] Purge cycle completed.');
        } catch (error) {
            logger.error('[CleanupService] Critical failure during purge cycle:', {
                error: error instanceof Error ? error.message : String(error)
            });
        } finally {
            this.isRunning = false;
            client.release();
        }
    }

    /**
     * 🧟 ZOMBIE SESSION PURGE (Meta-Grade)
     * Deletes active_connections that haven't pinged in over 90 seconds.
     * This ensures orphaned sessions from server crashes or network failures
     * are definitively reaped from the Institutional Truth Layer.
     */
    public async purgeZombiePresence(): Promise<void> {
        try {
            const result = await pool.query(
                `DELETE FROM active_connections 
                 WHERE last_ping < NOW() - INTERVAL '90 seconds'`
            );
            if ((result.rowCount || 0) > 0) {
                logger.info(`[CleanupService] Reaped ${result.rowCount} zombie presence sessions.`);
            }
        } catch (error: unknown) {
            logger.error('[CleanupService] Zombie purge failed:', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * ⏱️ SCHEDULED MAINTENANCE
     * Runs the cleanup jobs at institutional intervals.
     */
    public initialize(): void {
        // Initial run on startup
        this.purgeOrphanedAssets().then(() => {
            this.purgeAbandonedStaging();
            this.purgeZombiePresence();
        });

        // Deep Scan: Weekly institutional audit
        setInterval(() => this.purgeOrphanedAssets(), 7 * 24 * 60 * 60 * 1000);

        // Staging Purge: Daily Cron-like interval
        setInterval(() => this.purgeAbandonedStaging(), 24 * 60 * 60 * 1000);

        // Zombie Reaper: Meta-Grade 5-minute activity window (Institutional Standard)
        setInterval(() => this.purgeZombiePresence(), 5 * 60 * 1000);
        
        logger.info('[CleanupService] Institutional Cleanup Guardian initialized.');
    }
}

export const cleanupService = new CleanupService();
