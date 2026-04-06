import { Pool } from 'pg';
import { pool } from '../config/db';
import { logger } from '../utils/logger';

export interface SystemSetting {
    id: number;
    key: string;
    value: string;
    updated_at: Date;
}

export class SystemSettingsRepository {
    private db: Pool;

    constructor(db: Pool = pool) {
        this.db = db;
    }

    async getSetting(key: string): Promise<string | null> {
        try {
            const result = await this.db.query<{ value: string }>(
                'SELECT value FROM system_settings WHERE key = $1',
                [key]
            );
            return result.rows[0]?.value || null;
        } catch (error: unknown) {
            logger.error('Failed to get system setting', {
                error: error instanceof Error ? error.message : String(error),
                key
            });
            throw error;
        }
    }

    async updateSetting(key: string, value: string): Promise<void> {
        try {
            await this.db.query(
                `INSERT INTO system_settings (key, value, updated_at) 
                 VALUES ($1, $2, CURRENT_TIMESTAMP)
                 ON CONFLICT (key) DO 
                 UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
                [key, value]
            );
        } catch (error: unknown) {
            logger.error('Failed to update system setting', {
                error: error instanceof Error ? error.message : String(error),
                key
            });
            throw error;
        }
    }
}

export const systemSettingsRepository = new SystemSettingsRepository();
