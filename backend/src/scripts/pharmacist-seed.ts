/**
 * HAEMI PHARMACIST SEED — Final seed of demo data
 */
import '../config/env';
import { pool } from '../config/db';

async function seed(): Promise<void> {
    const client = await pool.connect();
    try {
        console.log('\n=== SEEDING PHARMACIST DEMO DATA ===\n');
        await client.query('BEGIN');

        const pharmacyRow = await client.query<{ id: number }>(`SELECT id FROM pharmacies LIMIT 1`);
        const patientRow = await client.query<{ id: string }>(`SELECT id FROM users WHERE role = 'patient' LIMIT 1`);
        const panaRow = await client.query<{ id: number }>(`SELECT id FROM medicines WHERE name ILIKE '%panado%' LIMIT 1`);
        const amoxRow = await client.query<{ id: number }>(`SELECT id FROM medicines WHERE name ILIKE '%amoxil%' OR name ILIKE '%amoxicillin%' LIMIT 1`);

        if (!pharmacyRow.rows[0] || !patientRow.rows[0]) {
            console.log('❌ No pharmacy or patient found. Cannot seed.');
            return;
        }

        const pharmacyId = pharmacyRow.rows[0].id;
        const patientId = patientRow.rows[0].id;

        // ── Update inventory to have realistic low-stock data ─────────────
        if (panaRow.rows[0]) {
            await client.query(`
                UPDATE pharmacy_inventory
                SET stock_quantity = 8, dispensed_today = 25, reorder_level = 20,
                    expiry_date = CURRENT_DATE + INTERVAL '14 days'
                WHERE medicine_id = $1 AND pharmacy_id = $2
            `, [panaRow.rows[0].id, pharmacyId]);
            console.log('✅ Updated: Panado Extra → LOW STOCK (8 units, reorder_level 20)');
        }

        if (amoxRow.rows[0]) {
            await client.query(`
                UPDATE pharmacy_inventory
                SET stock_quantity = 50, dispensed_today = 5, reorder_level = 20,
                    expiry_date = CURRENT_DATE + INTERVAL '180 days'
                WHERE medicine_id = $1 AND pharmacy_id = $2
            `, [amoxRow.rows[0].id, pharmacyId]);
            console.log('✅ Updated: Amoxil → Healthy stock');
        }

        // ── Seed Government Orders ────────────────────────────────────────
        const existingGov = await client.query<{ count: string }>(
            `SELECT COUNT(*) as count FROM orders WHERE pharmacy_id = $1 AND is_government_subsidized = TRUE`,
            [pharmacyId]
        );

        if (parseInt(existingGov.rows[0].count, 10) === 0) {
            const gov1 = await client.query<{ id: string }>(`
                INSERT INTO orders (patient_id, pharmacy_id, status, total_amount, is_prescription_required, delivery_mode, is_government_subsidized, omang_number, hospital_origin)
                VALUES ($1, $2, 'Pending', 0.00, TRUE, 'COLLECT', TRUE, '439218312', 'Princess Marina')
                RETURNING id
            `, [patientId, pharmacyId]);
            if (amoxRow.rows[0]) {
                await client.query(`INSERT INTO order_items (order_id, medicine_id, quantity, unit_price) VALUES ($1, $2, 1, 0.00)`, [gov1.rows[0].id, amoxRow.rows[0].id]);
            }
            console.log('✅ Seeded: Gov order #1 (Princess Marina / Omang: 439218312)');

            const gov2 = await client.query<{ id: string }>(`
                INSERT INTO orders (patient_id, pharmacy_id, status, total_amount, is_prescription_required, delivery_mode, is_government_subsidized, omang_number, hospital_origin)
                VALUES ($1, $2, 'Pending', 0.00, TRUE, 'COLLECT', TRUE, '782910392', 'Nyangabgwe Referral')
                RETURNING id
            `, [patientId, pharmacyId]);
            if (panaRow.rows[0]) {
                await client.query(`INSERT INTO order_items (order_id, medicine_id, quantity, unit_price) VALUES ($1, $2, 1, 0.00)`, [gov2.rows[0].id, panaRow.rows[0].id]);
            }
            console.log('✅ Seeded: Gov order #2 (Nyangabgwe / Omang: 782910392)');
        } else {
            console.log(`⏭ Government orders already exist (${existingGov.rows[0].count}). Skipping.`);
        }

        await client.query('COMMIT');

        // ── Final verification ────────────────────────────────────────────
        const stats = await client.query(`
            SELECT
                COUNT(*) FILTER (WHERE stock_quantity <= reorder_level) as low_stock,
                COUNT(*) FILTER (WHERE expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + INTERVAL '30 days') as expiring_soon,
                COALESCE(SUM(dispensed_today), 0) as total_dispensed
            FROM pharmacy_inventory
        `);
        const orderStats = await client.query(`
            SELECT
                COUNT(*) FILTER (WHERE status = 'Pending') as pending,
                COUNT(*) FILTER (WHERE is_government_subsidized = TRUE AND status = 'Pending') as gov_pending,
                COUNT(*) FILTER (WHERE is_government_subsidized = FALSE AND status = 'Pending') as direct_pending
            FROM orders
        `);

        console.log('\n📊 FINAL LIVE STATS:');
        console.log(`  Low Stock Alerts   : ${stats.rows[0].low_stock}`);
        console.log(`  Expiring Soon      : ${stats.rows[0].expiring_soon}`);
        console.log(`  Dispensed Today    : ${stats.rows[0].total_dispensed}`);
        console.log(`  Pending Orders     : ${orderStats.rows[0].pending}`);
        console.log(`  Gov Orders Pending : ${orderStats.rows[0].gov_pending}`);
        console.log(`  Direct Pending     : ${orderStats.rows[0].direct_pending}`);
        console.log('\n=== SEED COMPLETE ✅ ===\n');

    } catch (error: unknown) {
        await client.query('ROLLBACK');
        console.error('SEED FAILED:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
