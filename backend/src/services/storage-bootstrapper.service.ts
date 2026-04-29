import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { pool } from '../config/db';

/**
 * 🛡️ HAEMI LIFE: STORAGE BOOTSTRAPPER (v1.0)
 * Policy: Automatic Asset Restoration and Directory Enforcement
 * Goal: Zero 404s for critical institutional assets.
 */
export class StorageBootstrapper {
    static async initialize(): Promise<void> {
        logger.info('[Storage-Bootstrapper] Initiating physical asset verification...');

        const rootDir = path.resolve(__dirname, '../../..'); // Resolves to haemi-life-web
        const backendUploadsDir = path.join(rootDir, 'backend', 'uploads');
        
        // 1. Required Directories
        const requiredDirs = [
            'pharmacies',
            'profiles',
            'chat',
            'medical_records',
            'temp',
            '_quarantine'
        ];

        for (const dir of requiredDirs) {
            const dirPath = path.join(backendUploadsDir, dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                logger.info(`[Storage-Bootstrapper] Created missing directory: uploads/${dir}`);
            }
        }

        // 2. Critical Baseline Assets
        const requiredAssets = [
            {
                source: path.join(rootDir, 'frontend', 'src', 'assets', 'images', 'pharmacies', 'pharmacy_01.jpg'),
                destination: path.join(backendUploadsDir, 'pharmacies', 'pharmacy_01.jpg'),
                name: 'pharmacy_01.jpg'
            }
        ];

        for (const asset of requiredAssets) {
            if (!fs.existsSync(asset.destination)) {
                if (fs.existsSync(asset.source)) {
                    fs.copyFileSync(asset.source, asset.destination);
                    logger.info(`[Storage-Bootstrapper] Restored missing baseline asset: ${asset.name}`);
                } else {
                    logger.warn(`[Storage-Bootstrapper] Source asset missing, cannot restore: ${asset.source}`);
                }
            }
        }

        // 3. Forensic Data Parity Audit (Google/Meta Standard)
        // Checks if DB paths actually exist on disk.
        await this.performDataParityAudit(backendUploadsDir);

        logger.info('[Storage-Bootstrapper] Asset verification complete.');
    }

    private static async performDataParityAudit(uploadsDir: string): Promise<void> {
        try {
            const result = await pool.query('SELECT id, name, profile_image FROM users WHERE profile_image IS NOT NULL');
            let driftCount = 0;

            for (const row of result.rows) {
                if (row.profile_image.startsWith('http')) continue;

                // Normalize path (v2 Logic)
                const relativePath = row.profile_image
                    .replace(/^(\/)?(uploads\/)?/i, '')
                    .replace(/\\/g, '/')
                    .replace(/^\/+/, '');
                
                const fullPath = path.join(uploadsDir, relativePath);

                if (!fs.existsSync(fullPath)) {
                    driftCount++;
                    logger.error(`[Data-Drift-Alert] Missing physical asset for user ${row.name} (${row.id}). Path: ${row.profile_image}`);
                }
            }

            if (driftCount > 0) {
                logger.warn(`[Storage-Bootstrapper] Audit finished: Detected ${driftCount} assets with data drift.`);
            } else {
                logger.info('[Storage-Bootstrapper] Forensic Audit: 100% Data Parity Verified.');
            }
        } catch (error: unknown) {
            logger.error('[Storage-Bootstrapper] Audit failed to execute:', error);
        }
    }
}
