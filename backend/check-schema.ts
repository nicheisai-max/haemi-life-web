import { pool } from './src/config/db';

async function checkSchema() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'medical_record_files'
        `);
        console.log('Columns:', JSON.stringify(result.rows, null, 2));
    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        await pool.end();
    }
}

checkSchema();
