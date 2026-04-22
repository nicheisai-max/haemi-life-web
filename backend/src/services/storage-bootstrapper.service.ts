import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

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

        logger.info('[Storage-Bootstrapper] Asset verification complete.');
    }
}
