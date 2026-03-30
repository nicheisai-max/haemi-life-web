const { Client } = require('pg');

async function runAudit() {
    const client = new Client({
        user: 'postgres', host: 'localhost', database: 'digital_health_pharmacy_hub',
        password: 'Deepti@8143', port: 5432,
    });

    try {
        await client.connect();
        
        // 1. Check columns
        const cols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'active_connections'");
        console.log('Columns:', JSON.stringify(cols.rows, null, 2));

        // 2. Check constraints
        const constr = await client.query(`
            SELECT conname, contype, pg_get_constraintdef(oid) as definition
            FROM pg_constraint 
            WHERE conrelid = 'active_connections'::regclass
        `);
        console.log('Constraints:', JSON.stringify(constr.rows, null, 2));

        // 3. Check for indexes
        const idx = await client.query(`
            SELECT tablename, indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'active_connections'
        `);
        console.log('Indexes:', JSON.stringify(idx.rows, null, 2));

    } catch (err) {
        console.error('Audit failed:', err);
    } finally {
        await client.end();
    }
}

runAudit();
