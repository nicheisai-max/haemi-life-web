import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { logger } from '../utils/logger';

// Load env from backend/.env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function runMigration() {
    logger.info('--- CRITICAL SCHEMA MIGRATION: Conversations Table ---');
    logger.info(`Connecting to: ${process.env.DB_NAME} on ${process.env.DB_HOST}`);
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Add last_message_id
        logger.info('Checking last_message_id...');
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='last_message_id') THEN
                    ALTER TABLE conversations ADD COLUMN last_message_id UUID;
                    RAISE NOTICE 'Added last_message_id column';
                END IF;
            END $$;
        `);

        // 2. Add preview_text
        logger.info('Checking preview_text...');
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='preview_text') THEN
                    ALTER TABLE conversations ADD COLUMN preview_text TEXT;
                    RAISE NOTICE 'Added preview_text column';
                END IF;
            END $$;
        `);

        // 3. Add last_message_at
        logger.info('Checking last_message_at...');
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversations' AND column_name='last_message_at') THEN
                    ALTER TABLE conversations ADD COLUMN last_message_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
                    RAISE NOTICE 'Added last_message_at column';
                END IF;
            END $$;
        `);

        await client.query('COMMIT');
        logger.info('SUCCESS: All columns verified/added.');
    } catch (err: unknown) {
        await client.query('ROLLBACK');
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error('CRITICAL MIGRATION FAILURE:', { 
            error: errorMessage,
            stack: err instanceof Error ? err.stack : undefined
        });
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
