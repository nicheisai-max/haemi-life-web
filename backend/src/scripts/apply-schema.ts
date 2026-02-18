
import { pool } from '../config/db';
import fs from 'fs';
import path from 'path';

const applySchema = async () => {
    const client = await pool.connect();
    try {
        console.log('🔄 Applying Database Schema from init.sql...');

        const initSqlPath = path.join(__dirname, '../db/init.sql');
        const sql = fs.readFileSync(initSqlPath, 'utf8');

        // Execute the SQL
        // Note: simple splitting by ; might not work for PL/PGSQL blocks ($$), 
        // but let's try just executing the whole thing if the driver supports multiple statements.
        // node-postgres supports query strings with multiple statements if they are just basic SQL,
        // but complex blocks usually work fine as a single query too.

        await client.query(sql);

        console.log('✅ Schema applied successfully.');
    } catch (error) {
        console.error('❌ Failed to apply schema:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
};

applySchema();
