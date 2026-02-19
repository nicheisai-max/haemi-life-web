import { Pool } from 'pg';
import { pool } from '../config/db';

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
        const result = await this.db.query(
            'SELECT value FROM system_settings WHERE key = $1',
            [key]
        );
        return result.rows[0]?.value || null;
    }

    async updateSetting(key: string, value: string): Promise<void> {
        await this.db.query(
            `INSERT INTO system_settings (key, value, updated_at) 
             VALUES ($1, $2, NOW())
             ON CONFLICT (key) DO 
             UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [key, value]
        );
    }
}

export const systemSettingsRepository = new SystemSettingsRepository();
