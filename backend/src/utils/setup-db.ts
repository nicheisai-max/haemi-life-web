import { pool } from '../config/db';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || '123456';

async function setupDatabase() {
    let client;
    try {
        console.log('🔌 Connecting to database...');
        client = await pool.connect();

        console.log('📄 Reading init.sql...');
        const sqlPath = path.join(__dirname, '../db/init.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Hash the demo password
        console.log('🔐 Hashing demo password (123456)...');
        const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

        // Prepare specific SQL execution
        // We need to pass the password hash to the procedure call
        // The SQL file defines the procedure `sp_seed_demo_data(p_password_hash)`.
        // We need to CALL this procedure from this script.

        console.log('🚀 Executing Schema & Procedures...');

        // 1. Run the entire Init SQL to define tables and procedures
        await client.query(sql);
        console.log('✅ Schema and Procedures created successfully.');

        // 2. Call the Seed Procedure
        console.log('🌱 Seeding Demo Data...');
        await client.query('CALL sp_seed_demo_data($1)', [passwordHash]);

        console.log('\n✨ Database Setup Completed Successfully! ✨');
        console.log('==========================================');
        console.log(`🔑 Demo Password: ${DEMO_PASSWORD}`);
        console.log('   - patient@haemilife.com');
        console.log('   - doctor@haemilife.com');
        console.log('   - pharmacist@haemilife.com');
        console.log('   - admin@haemilife.com');
        console.log('==========================================\n');

    } catch (error) {
        console.error('❌ Database Setup Failed:', error);
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

setupDatabase();
