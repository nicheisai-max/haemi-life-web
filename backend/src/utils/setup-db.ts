import { pool } from '../config/db';
import * as fs from 'fs';
import * as path from 'path';
import bcrypt from 'bcrypt';
import { logger } from './logger';

const DEMO_PASSWORD = process.env.DEMO_PASSWORD as string;

if (!DEMO_PASSWORD) {
    logger.error('❌ P0_CRITICAL: DEMO_PASSWORD environment variable is missing.');
    logger.error('Institutional security policy forbids default credential fallbacks.');
    process.exit(1);
}

async function setupDatabase() {
    let client;
    try {
        logger.info('🔌 Connecting to database...');
        client = await pool.connect();

        await client.query('BEGIN');

        // 1. Create Migration Registry
        logger.info('🛠 Initializing Migration Registry...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);

        // 2. Baseline Sync (init.sql)
        logger.info('📄 Reading init.sql baseline...');
        const sqlPath = path.join(__dirname, '../db/init.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sql);
        logger.info('✅ Baseline schema synchronized.');

        // 3. Automated Migration Runner (Discovery & Execution)
        const migrationsDir = path.join(__dirname, '../db/migrations');
        if (fs.existsSync(migrationsDir)) {
            const migrationFiles = fs.readdirSync(migrationsDir)
                .filter(f => f.endsWith('.sql'))
                .sort(); // Sequential alphanumeric execution

            logger.info(`🚀 Scanning for delta migrations in ${migrationsDir}...`);

            for (const file of migrationFiles) {
                const { rows } = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
                
                if (rows.length === 0) {
                    logger.info(`📝 Applying migration: ${file}...`);
                    const migrationSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
                    await client.query(migrationSql);
                    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
                    logger.info(`✅ ${file} applied successfully.`);
                } else {
                    logger.info(`⏭ Skipping ${file} (already applied).`);
                }
            }
        }

        // 4. Seed Demo Data
        logger.info('🔐 Hashing demo password for identity seeding...');
        const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
        logger.info('🌱 Seeding Institutional Data...');
        await client.query('CALL sp_seed_demo_data($1)', [passwordHash]);

        await client.query('COMMIT');
        logger.info('\n✨ Database Institutional Restoration Completed Successfully! ✨');

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('FULL ERROR:', error);
        logger.error('❌ Institutional Restoration Failed:', { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

setupDatabase();
