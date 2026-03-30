const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'digital_health_pharmacy_hub',
    password: 'Deepti@8143',
    port: 5432,
});

async function checkSchema() {
    try {
        const result = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'messages'");
        console.log(JSON.stringify(result.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkSchema();
