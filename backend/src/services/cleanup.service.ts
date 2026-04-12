import { pool } from '../config/db';
import { fileService } from './file.service';
import { logger } from '../utils/logger';

/**
 * 🩺 HAEMI LIFE — FORENSIC CLEANUP SERVICE (v5.2)
 * Institutional Utility: Identifies and purges abandoned "Ghost Files" 
 * from the chat staging area (uploads/chat/temp).
 * Now includes Meta-Grade 'Zombie Session' Reaper.
 */

class CleanupService {
    private isRunning = false;

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
            const result = await client.query<{ id: number, name: string }>(
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
                    logger.error(`[CleanupService] Failed to purge individual asset ID ${row.id}:`, rowErr);
                }
            }

            logger.info('[CleanupService] Purge cycle completed.');
        } catch (error) {
            logger.error('[CleanupService] Critical failure during purge cycle:', error);
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
        this.purgeAbandonedStaging();
        this.purgeZombiePresence();

        // Staging Purge: Daily Cron-like interval
        setInterval(() => this.purgeAbandonedStaging(), 24 * 60 * 60 * 1000);

        // Zombie Reaper: Meta-Grade 5-minute activity window (Institutional Standard)
        setInterval(() => this.purgeZombiePresence(), 5 * 60 * 1000);
        
        logger.info('[CleanupService] Institutional Cleanup Guardian initialized.');
    }
}

export const cleanupService = new CleanupService();
