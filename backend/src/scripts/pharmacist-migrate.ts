/**
 * HAEMI PHARMACIST MIGRATION
 * Applies Botswana Launch columns idempotently to the live database.
 * Run: npx tsx backend/src/scripts/pharmacist-migrate.ts
 */
import { pool } from '../config/db';
import { logger } from '../utils/logger';

const MIGRATION_ID = 'pharmacist_botswana_v1';

async function applyPharmacistMigration(): Promise<void> {
    const client = await pool.connect();
    try {
        logger.info(`[Migration] Starting: ${MIGRATION_ID}`);
        await client.query('BEGIN');

        // ── pharmacy_inventory: add pharmacist columns ─────────────────────
        const piCols = await client.query<{ column_name: string }>(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'pharmacy_inventory'
            AND column_name IN ('dispensed_today', 'reorder_level', 'expiry_date')
        `);
        const piExisting = new Set(piCols.rows.map(r => r.column_name));

        if (!piExisting.has('dispensed_today')) {
            await client.query(`ALTER TABLE pharmacy_inventory ADD COLUMN dispensed_today INTEGER NOT NULL DEFAULT 0`);
            logger.info('[Migration] ✅ Added: pharmacy_inventory.dispensed_today');
        }
        if (!piExisting.has('reorder_level')) {
            await client.query(`ALTER TABLE pharmacy_inventory ADD COLUMN reorder_level INTEGER NOT NULL DEFAULT 10`);
            logger.info('[Migration] ✅ Added: pharmacy_inventory.reorder_level');
        }
        if (!piExisting.has('expiry_date')) {
            await client.query(`ALTER TABLE pharmacy_inventory ADD COLUMN expiry_date DATE`);
            logger.info('[Migration] ✅ Added: pharmacy_inventory.expiry_date');
        }

        // ── orders: add pharmacist columns ────────────────────────────────
        const ordCols = await client.query<{ column_name: string }>(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'orders'
            AND column_name IN ('prescription_url', 'is_prescription_required', 'delivery_mode', 'is_government_subsidized', 'omang_number', 'hospital_origin')
        `);
        const ordExisting = new Set(ordCols.rows.map(r => r.column_name));

        if (!ordExisting.has('prescription_url')) {
            await client.query(`ALTER TABLE orders ADD COLUMN prescription_url TEXT`);
            logger.info('[Migration] ✅ Added: orders.prescription_url');
        }
        if (!ordExisting.has('is_prescription_required')) {
            await client.query(`ALTER TABLE orders ADD COLUMN is_prescription_required BOOLEAN NOT NULL DEFAULT FALSE`);
            logger.info('[Migration] ✅ Added: orders.is_prescription_required');
        }
        if (!ordExisting.has('delivery_mode')) {
            await client.query(`ALTER TABLE orders ADD COLUMN delivery_mode VARCHAR(50) NOT NULL DEFAULT 'COLLECT'`);
            logger.info('[Migration] ✅ Added: orders.delivery_mode');
        }
        if (!ordExisting.has('is_government_subsidized')) {
            await client.query(`ALTER TABLE orders ADD COLUMN is_government_subsidized BOOLEAN NOT NULL DEFAULT FALSE`);
            logger.info('[Migration] ✅ Added: orders.is_government_subsidized');
        }
        if (!ordExisting.has('omang_number')) {
            await client.query(`ALTER TABLE orders ADD COLUMN omang_number VARCHAR(50)`);
            logger.info('[Migration] ✅ Added: orders.omang_number');
        }
        if (!ordExisting.has('hospital_origin')) {
            await client.query(`ALTER TABLE orders ADD COLUMN hospital_origin VARCHAR(100)`);
            logger.info('[Migration] ✅ Added: orders.hospital_origin');
        }

        // ── Seed Demo Data (idempotent) ────────────────────────────────────
        // Get a pharmacist user and a pharmacy to seed data against
        const pharmacistRow = await client.query<{ id: string }>(
            `SELECT id FROM users WHERE role = 'pharmacist' LIMIT 1`
        );
        const pharmacyRow = await client.query<{ id: number }>(
            `SELECT id FROM pharmacies LIMIT 1`
        );

        if (pharmacistRow.rows.length > 0 && pharmacyRow.rows.length > 0) {
            const pharmacyId = pharmacyRow.rows[0].id;

            // Seed inventory: Panado Extra (low stock, expiring soon)
            const panaRow = await client.query<{ id: number }>(
                `SELECT id FROM medicines WHERE name ILIKE '%panado%' LIMIT 1`
            );
            const amoxRow = await client.query<{ id: number }>(
                `SELECT id FROM medicines WHERE name ILIKE '%amoxil%' OR name ILIKE '%amoxicillin%' LIMIT 1`
            );

            if (panaRow.rows.length > 0) {
                await client.query(`
                    INSERT INTO pharmacy_inventory (pharmacy_id, medicine_id, price, stock_quantity, dispensed_today, reorder_level, expiry_date)
                    VALUES ($1, $2, 35.00, 8, 25, 20, CURRENT_DATE + INTERVAL '14 days')
                    ON CONFLICT (pharmacy_id, medicine_id) DO UPDATE
                    SET stock_quantity = 8, dispensed_today = 25, reorder_level = 20,
                        expiry_date = CURRENT_DATE + INTERVAL '14 days'
                `, [pharmacyId, panaRow.rows[0].id]);
                logger.info('[Migration] 🌱 Seeded: Panado Extra inventory (low stock + expiring soon)');
            }

            if (amoxRow.rows.length > 0) {
                await client.query(`
                    INSERT INTO pharmacy_inventory (pharmacy_id, medicine_id, price, stock_quantity, dispensed_today, reorder_level, expiry_date)
                    VALUES ($1, $2, 120.00, 50, 5, 20, CURRENT_DATE + INTERVAL '180 days')
                    ON CONFLICT (pharmacy_id, medicine_id) DO UPDATE
                    SET stock_quantity = 50, dispensed_today = 5, reorder_level = 20,
                        expiry_date = CURRENT_DATE + INTERVAL '180 days'
                `, [pharmacyId, amoxRow.rows[0].id]);
                logger.info('[Migration] 🌱 Seeded: Amoxil inventory (healthy stock)');
            }

            // Seed orders: check if pharmacist orders already exist
            const patientRow = await client.query<{ id: string }>(
                `SELECT id FROM users WHERE role = 'patient' LIMIT 1`
            );

            if (patientRow.rows.length > 0) {
                const patientId = patientRow.rows[0].id;
                const existingOrders = await client.query<{ count: string }>(
                    `SELECT COUNT(*) as count FROM orders WHERE pharmacy_id = $1 AND is_government_subsidized = TRUE`,
                    [pharmacyId]
                );

                if (parseInt(existingOrders.rows[0].count, 10) === 0) {
                    // Gov order 1: Princess Marina
                    const govOrder1 = await client.query<{ id: string }>(
                        `INSERT INTO orders (patient_id, pharmacy_id, status, total_amount, is_prescription_required, delivery_mode, is_government_subsidized, omang_number, hospital_origin)
                         VALUES ($1, $2, 'Pending', 0.00, TRUE, 'COLLECT', TRUE, '439218312', 'Princess Marina')
                         RETURNING id`,
                        [patientId, pharmacyId]
                    );
                    if (amoxRow.rows.length > 0) {
                        await client.query(
                            `INSERT INTO order_items (order_id, medicine_id, quantity, unit_price) VALUES ($1, $2, 1, 0.00)`,
                            [govOrder1.rows[0].id, amoxRow.rows[0].id]
                        );
                    }
                    logger.info('[Migration] 🌱 Seeded: Government order (Princess Marina)');

                    // Gov order 2: Nyangabgwe Referral
                    const govOrder2 = await client.query<{ id: string }>(
                        `INSERT INTO orders (patient_id, pharmacy_id, status, total_amount, is_prescription_required, delivery_mode, is_government_subsidized, omang_number, hospital_origin)
                         VALUES ($1, $2, 'Pending', 0.00, TRUE, 'COLLECT', TRUE, '782910392', 'Nyangabgwe Referral')
                         RETURNING id`,
                        [patientId, pharmacyId]
                    );
                    if (panaRow.rows.length > 0) {
                        await client.query(
                            `INSERT INTO order_items (order_id, medicine_id, quantity, unit_price) VALUES ($1, $2, 1, 0.00)`,
                            [govOrder2.rows[0].id, panaRow.rows[0].id]
                        );
                    }
                    logger.info('[Migration] 🌱 Seeded: Government order (Nyangabgwe Referral)');
                } else {
                    logger.info('[Migration] ⏭ Government orders already seeded, skipping.');
                }
            }
        } else {
            logger.warn('[Migration] ⚠️ No pharmacist/pharmacy found. Run db:setup first to create demo data.');
        }

        await client.query('COMMIT');
        logger.info(`[Migration] ✨ ${MIGRATION_ID} completed successfully.`);

    } catch (error: unknown) {
        await client.query('ROLLBACK');
        logger.error('[Migration] ❌ FAILED — ROLLBACK applied:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

applyPharmacistMigration();
