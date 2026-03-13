import { pool } from '../config/db';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';

const DEMO_PASSWORD = process.env.DEMO_PASSWORD as string;

if (!DEMO_PASSWORD) {
    console.error('❌ P0_CRITICAL: DEMO_PASSWORD environment variable is missing.');
    console.error('Institutional security policy forbids default credential fallbacks.');
    process.exit(1);
}

async function setupDatabase() {
    let client;
    try {
        console.log('🔌 Connecting to database...');
        client = await pool.connect();

        await client.query('BEGIN');

        // 1. Create Migration Registry
        console.log('🛠 Initializing Migration Registry...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // 2. Baseline Sync (init.sql)
        console.log('📄 Reading init.sql baseline...');
        const sqlPath = path.join(__dirname, '../db/init.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sql);
        console.log('✅ Baseline schema synchronized.');

        // 3. Automated Migration Runner (Discovery & Execution)
        const migrationsDir = path.join(__dirname, '../db/migrations');
        if (fs.existsSync(migrationsDir)) {
            const migrationFiles = fs.readdirSync(migrationsDir)
                .filter(f => f.endsWith('.sql'))
                .sort(); // Sequential alphanumeric execution

            console.log(`🚀 Scanning for delta migrations in ${migrationsDir}...`);

            for (const file of migrationFiles) {
                const { rows } = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
                
                if (rows.length === 0) {
                    console.log(`📝 Applying migration: ${file}...`);
                    const migrationSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
                    await client.query(migrationSql);
                    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
                    console.log(`✅ ${file} applied successfully.`);
                } else {
                    console.log(`⏭ Skipping ${file} (already applied).`);
                }
            }
        }

        // 4. Seed Demo Data
        console.log('🔐 Hashing demo password for identity seeding...');
        const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
        console.log('🌱 Seeding Institutional Data...');
        await client.query('CALL sp_seed_demo_data($1)', [passwordHash]);

        await client.query('COMMIT');
        console.log('\n✨ Database Institutional Restoration Completed Successfully! ✨');

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('❌ Institutional Restoration Failed:', error);
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

setupDatabase();
