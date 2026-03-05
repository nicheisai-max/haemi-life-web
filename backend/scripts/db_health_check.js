const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Deepti@8143',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'digital_health_pharmacy_hub',
});

async function runHealthCheck() {
    console.log("\n🩺 HAEMI LIFE — DATABASE OBSERVABILITY HEALTH CHECK");
    console.log("-----------------------------------------------");

    const client = await pool.connect();
    try {
        const sqlPath = path.join(__dirname, 'db_health_report.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolon and run each query
        const queries = sql.split('--').filter(q => q.trim().length > 0);

        for (const section of queries) {
            const lines = section.trim().split('\n');
            const title = lines[0].replace(/--/g, '').trim();
            const query = lines.slice(1).join('\n').trim();

            if (query) {
                console.log(`\n📊 ${title}`);
                try {
                    const res = await client.query(query);
                    if (res.rows.length > 0) {
                        console.table(res.rows);
                    } else {
                        console.log("No data found for this metric.");
                    }
                } catch (err) {
                    console.error(`Error running ${title}:`, err.message);
                }
            }
        }

        console.log("\n✅ Health check completed successfully.");
    } catch (err) {
        console.error("\n❌ Health check failed:", err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

runHealthCheck().catch(err => {
    console.error("Critical health check error:", err.message);
    process.exit(0); // Never block startup
});
