import { pool } from '../config/db';
import fs from 'fs';
import path from 'path';

async function createTables() {
    console.log('🚀 Initializing database tables...');
    try {
        const sqlPath = path.join(__dirname, 'create-api-tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // DROP dependent tables first to avoid FK constraints
        await pool.query('DROP TABLE IF EXISTS audit_logs, prescription_items, prescriptions, appointments, doctor_schedules, doctor_profiles CASCADE');

        // Execute the entire SQL script
        await pool.query(sql);
        console.log('✅ Database tables initialized successfully!');
    } catch (error) {
        console.error('❌ Error initializing database tables:', error);
    } finally {
        await pool.end();
    }
}

createTables();
