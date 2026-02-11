import { pool } from '../config/db';

async function checkSchema() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'id'
        `);
        console.log('User ID Type:', JSON.stringify(res.rows, null, 2));
    } catch (error) {
        console.error('Error checking schema:', error);
    } finally {
        await pool.end();
    }
}

checkSchema();
