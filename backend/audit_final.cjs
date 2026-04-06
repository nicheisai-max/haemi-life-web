const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'digital_health_pharmacy_hub',
    password: 'Deepti@8143',
    port: 5432,
});

async function auditSchema() {
    try {
        console.log('--- READ-ONLY SCHEMA AUDIT (JS) ---');
        
        // 1. Check migrations
        const migrations = await pool.query('SELECT name, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 10');
        console.log('\n[RECORDS] Latest Migrations Applied:');
        console.table(migrations.rows);

        // 2. Check message_attachments columns
        const columns = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'message_attachments'
        `);
        console.log('\n[TABLE] message_attachments Structure:');
        console.table(columns.rows);

        // 3. Final Integrity Verdict (READ-ONLY)
        const hasUrl = columns.rows.some(r => r.column_name === 'file_url');
        const hasType = columns.rows.some(r => r.column_name === 'file_type');
        
        console.log('\n--- VERDICT ---');
        console.log(`file_url detected: ${hasUrl}`);
        console.log(`file_type detected: ${hasType}`);
        console.log('--- AUDIT COMPLETE ---');

    } catch (err) {
        console.error('Audit Error:', err);
    } finally {
        await pool.end();
    }
}

auditSchema();
