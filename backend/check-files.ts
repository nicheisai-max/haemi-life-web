import { pool } from './src/config/db';

async function checkFiles() {
    const recordId = 'f622dbf2-326c-4001-a1bf-f9113eac7696';
    try {
        const result = await pool.query('SELECT * FROM medical_record_files WHERE record_id = $1', [recordId]);
        console.log('Files for record:', JSON.stringify(result.rows, null, 2));
    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        await pool.end();
    }
}

checkFiles();
