import { pool } from './src/config/db';

async function checkAllRecords() {
    try {
        const result = await pool.query('SELECT id, name, file_path FROM medical_records LIMIT 20');
        console.log('Records:', JSON.stringify(result.rows, null, 2));
    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        await pool.end();
    }
}

checkAllRecords();
