import { pool } from '../config/db';
import { logger } from '../utils/logger';

/**
 * 💰 HAEMI LIFE: INSTITUTIONAL REAL-TIME REVENUE SEEDER
 * Policy: Hybrid Ledger Generation (Historic Baseline + Live Orders).
 * Standard: Google/Meta Forensic Seeding Protocols.
 */
async function seedRealtimeRevenue() {
    const client = await pool.connect();
    try {
        logger.info('🌱 Starting Institutional Revenue Seeding (Real-time Upgrade)...');
        await client.query('BEGIN');

        // 1. Seed Historic Baseline (Oct 2025 - Dec 2025)
        // These go into the revenue_stats table as historical anchors.
        const historicMonths = [
            { month: 'Oct 2025', revenue: 125000, expenses: 78000, created_at: '2025-10-01' },
            { month: 'Nov 2025', revenue: 138000, expenses: 82000, created_at: '2025-11-01' },
            { month: 'Dec 2025', revenue: 155000, expenses: 95000, created_at: '2025-12-01' },
        ];

        for (const data of historicMonths) {
            await client.query(`
                INSERT INTO revenue_stats (month, revenue, expenses, created_at)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (month) DO UPDATE 
                SET revenue = EXCLUDED.revenue, expenses = EXCLUDED.expenses
            `, [data.month, data.revenue, data.expenses, data.created_at]);
        }
        logger.info('✅ Historic baseline data anchored.');

        // 2. Seed Live Ledger (Jan 2026 - Current)
        // We create real orders to drive the dynamic aggregation engine.
        const liveMonths = [
            { name: 'Jan 2026', revenue: 168000, date: '2026-01-15' },
            { name: 'Feb 2026', revenue: 182000, date: '2026-02-15' },
            { name: 'Mar 2026', revenue: 215000, date: '2026-03-15' },
            { name: 'Apr 2026', revenue: 95000, date: '2026-04-10' }, // Current month partial
        ];

        // Fetch a patient and pharmacy to attach orders to
        const patientRes = await client.query("SELECT id FROM users WHERE role = 'patient' LIMIT 1");
        const pharmacyRes = await client.query("SELECT id FROM pharmacies LIMIT 1");
        
        const patientId = patientRes.rows[0]?.id;
        const pharmacyId = pharmacyRes.rows[0]?.id;

        if (!patientId || !pharmacyId) {
            throw new Error('P0_CRITICAL: Identity registry or Pharmacy hub empty. Run core seed first.');
        }

        for (const data of liveMonths) {
             // We create one 'Aggregated Institutional Order' per month for demo purposes
             // This order is marked as 'Completed' to trigger the real-time revenue logic.
             await client.query(`
                INSERT INTO orders (patient_id, pharmacy_id, status, total_amount, created_at, updated_at)
                VALUES ($1, $2, 'Completed', $3, $4, $4)
             `, [patientId, pharmacyId, data.revenue, data.date]);
        }
        logger.info('✅ Live order ledger populated for real-time aggregation.');

        await client.query('COMMIT');
        logger.info('✨ INSTITUTIONAL REVENUE UPGRADE: COMPLETE');
    } catch (error: unknown) {
        await client.query('ROLLBACK');
        logger.error('❌ SEEDING FAILURE: Transaction Aborted', {
            error: error instanceof Error ? error.message : String(error)
        });
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

seedRealtimeRevenue();
