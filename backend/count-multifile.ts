import { pool } from './src/config/db';

async function countMultiFile() {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM medical_records WHERE file_path = $1', ['MULTI_FILE']);
        console.log('MULTI_FILE count:', result.rows[0].count);

        const samples = await pool.query('SELECT id, name FROM medical_records WHERE file_path = $1 LIMIT 5', ['MULTI_FILE']);
        console.log('Samples:', JSON.stringify(samples.rows, null, 2));
    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        await pool.end();
    }
}

countMultiFile();
