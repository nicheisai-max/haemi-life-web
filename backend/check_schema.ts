import { pool } from './src/config/db';

async function checkSchema() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'message_attachments'
            ORDER BY ordinal_position;
        `);
        console.log('Columns in message_attachments:');
        res.rows.forEach(row => {
            console.log(`- ${row.column_name}: ${row.data_type}`);
        });
        
        const indexes = await pool.query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'message_attachments';
        `);
        console.log('\nIndexes in message_attachments:');
        indexes.rows.forEach(row => {
            console.log(`- ${row.indexname}: ${row.indexdef}`);
        });
        
        process.exit(0);
    } catch (err) {
        console.error('Error checking schema:', err);
        process.exit(1);
    }
}

checkSchema();
