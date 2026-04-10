import { pool } from '../config/db';
import { logger } from '../utils/logger';

async function verifyData() {
    const client = await pool.connect();
    try {
        logger.info('🔍 Verifying seeded data...');
        
        const visits = await client.query('SELECT COUNT(*) FROM analytics_daily_visits');
        const revenue = await client.query('SELECT COUNT(*) FROM revenue_stats');
        const appointments = await client.query('SELECT COUNT(*) FROM appointments WHERE status = $1', ['completed']);
        const topDiagnoses = await client.query('SELECT reason, COUNT(*) as count FROM appointments GROUP BY reason ORDER BY count DESC LIMIT 5');

        console.log('--- VERIFICATION REPORT ---');
        console.log(`Analytics Daily Visits: ${visits.rows[0].count}`);
        console.log(`Revenue Stats: ${revenue.rows[0].count}`);
        console.log(`Completed Appointments: ${appointments.rows[0].count}`);
        console.log('Top Diagnoses (Sample):');
        topDiagnoses.rows.forEach(r => console.log(`  - ${r.reason}: ${r.count}`));
        console.log('---------------------------');

    } finally {
        client.release();
        await pool.end();
    }
}

verifyData();
