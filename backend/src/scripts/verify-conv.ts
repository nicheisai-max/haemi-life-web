import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { logger } from '../utils/logger';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function verify() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'conversations'
            AND column_name IN ('last_message_id', 'preview_text', 'last_message_at')
        `);
        logger.info('Verification Results:', res.rows);
        process.exit(0);
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error('CRITICAL VERIFICATION FAILURE:', { error: errorMessage });
        process.exit(1);
    } finally {
        await pool.end();
    }
}

verify();
