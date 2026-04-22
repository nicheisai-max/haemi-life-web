import type { Request, Response } from 'express';
import { pool } from '../config/db';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';
import type { PharmacyInventoryEntity, OrderEntity, DashboardStats } from '../types/pharmacist.types';

// ─── Institutional Guard: Dashboard Logic ─────────────────────────────

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
        // Step 1: Check if pharmacy_inventory has the required columns
        const columnsCheck = await pool.query<{ column_name: string }>(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'pharmacy_inventory'
            AND column_name IN ('dispensed_today', 'reorder_level', 'expiry_date')
        `);

        const existingCols = new Set(columnsCheck.rows.map(r => r.column_name));
        const hasAllCols = existingCols.has('dispensed_today') && existingCols.has('reorder_level') && existingCols.has('expiry_date');

        let stats: DashboardStats;

        if (hasAllCols) {
            // Full query when all columns exist
            const result = await pool.query<{
                low_stock_count: string;
                expiring_soon_count: string;
                total_dispensed: string;
            }>(`
                SELECT
                    COUNT(*) FILTER (WHERE stock_quantity <= reorder_level) AS low_stock_count,
                    COUNT(*) FILTER (WHERE expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + INTERVAL '30 days') AS expiring_soon_count,
                    COALESCE(SUM(dispensed_today), 0) AS total_dispensed
                FROM pharmacy_inventory
            `);

            stats = {
                lowStockCount: parseInt(result.rows[0]?.low_stock_count ?? '0', 10),
                expiringSoonCount: parseInt(result.rows[0]?.expiring_soon_count ?? '0', 10),
                totalDispensedToday: parseInt(result.rows[0]?.total_dispensed ?? '0', 10),
            };
        } else {
            // Degraded mode: columns not yet migrated — return safe defaults
            logger.warn('[Pharmacist] Dashboard stats degraded: pharmacy_inventory missing pharmacist columns. Run db:setup to apply migrations.');
            const result = await pool.query<{ total: string }>(`SELECT COUNT(*) as total FROM pharmacy_inventory`);
            stats = {
                lowStockCount: 0,
                expiringSoonCount: 0,
                totalDispensedToday: parseInt(result.rows[0]?.total ?? '0', 10),
            };
        }

        return sendResponse(res, 200, true, 'Dashboard stats fetched successfully', stats);
    } catch (error: unknown) {
        logger.error('[Pharmacist] Error fetching dashboard stats:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        return sendError(res, 500, 'Error fetching dashboard stats');
    }
};

export const getInventory = async (req: Request, res: Response): Promise<void> => {
    try {
        // Check if pharmacy_inventory has pharmacist columns
        const columnsCheck = await pool.query<{ column_name: string }>(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'pharmacy_inventory'
            AND column_name IN ('dispensed_today', 'reorder_level', 'expiry_date')
        `);
        const existingCols = new Set(columnsCheck.rows.map(r => r.column_name));

        const selectCols = [
            'pi.id',
            'pi.pharmacy_id',
            'pi.medicine_id',
            'pi.price',
            'pi.stock_quantity',
            'pi.created_at',
            'pi.updated_at',
            'm.name AS medicine_name',
            'm.category AS medicine_category',
            existingCols.has('dispensed_today') ? 'pi.dispensed_today' : '0 AS dispensed_today',
            existingCols.has('reorder_level') ? 'pi.reorder_level' : '10 AS reorder_level',
            existingCols.has('expiry_date') ? 'pi.expiry_date' : 'NULL::DATE AS expiry_date',
        ].join(', ');

        const result = await pool.query<PharmacyInventoryEntity>(`
            SELECT ${selectCols}
            FROM pharmacy_inventory pi
            LEFT JOIN medicines m ON pi.medicine_id = m.id
            ORDER BY pi.stock_quantity ASC
        `);

        return sendResponse(res, 200, true, 'Inventory fetched successfully', result.rows);
    } catch (error: unknown) {
        logger.error('[Pharmacist] Error fetching inventory:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        return sendError(res, 500, 'Error fetching inventory');
    }
};

export const getOrders = async (req: Request, res: Response): Promise<void> => {
    try {
        // Check if orders has pharmacist columns
        const columnsCheck = await pool.query<{ column_name: string }>(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'orders'
            AND column_name IN (
                'prescription_url', 
                'is_prescription_required', 
                'delivery_mode',
                'is_government_subsidized',
                'omang_number',
                'hospital_origin'
            )
        `);
        const existingCols = new Set(columnsCheck.rows.map(r => r.column_name));

        const selectCols = [
            'o.id',
            'o.patient_id',
            'o.pharmacy_id',
            'o.status',
            'o.total_amount',
            'o.created_at',
            'o.updated_at',
            'u.name AS patient_name',
            existingCols.has('prescription_url') ? 'o.prescription_url' : 'NULL::TEXT AS prescription_url',
            existingCols.has('is_prescription_required') ? 'o.is_prescription_required' : 'FALSE AS is_prescription_required',
            existingCols.has('delivery_mode') ? "o.delivery_mode" : "'COLLECT'::VARCHAR AS delivery_mode",
            existingCols.has('is_government_subsidized') ? 'o.is_government_subsidized' : 'FALSE AS is_government_subsidized',
            existingCols.has('omang_number') ? 'o.omang_number' : 'NULL::VARCHAR AS omang_number',
            existingCols.has('hospital_origin') ? 'o.hospital_origin' : 'NULL::VARCHAR AS hospital_origin',
        ].join(', ');

        const result = await pool.query<OrderEntity>(`
            SELECT ${selectCols}
            FROM orders o
            LEFT JOIN users u ON o.patient_id = u.id
            ORDER BY o.created_at DESC
            LIMIT 50
        `);

        return sendResponse(res, 200, true, 'Orders fetched successfully', result.rows);
    } catch (error: unknown) {
        logger.error('[Pharmacist] Error fetching orders:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        return sendError(res, 500, 'Error fetching orders');
    }
};

export const approveOrder = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
        return sendError(res, 400, 'Invalid order ID');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if order exists and is pending
        const orderResult = await client.query<{ id: string; status: string; pharmacy_id: number }>(
            'SELECT id, status, pharmacy_id FROM orders WHERE id = $1',
            [id]
        );

        if ((orderResult.rowCount ?? 0) === 0) {
            await client.query('ROLLBACK');
            return sendError(res, 404, 'Order not found');
        }

        const order = orderResult.rows[0];
        if (order.status !== 'Pending') {
            await client.query('ROLLBACK');
            return sendError(res, 400, 'Order is already processed');
        }

        // Get order items (only if order_items table exists with expected columns)
        const itemsResult = await client.query<{ quantity: number; medicine_id: number }>(
            'SELECT quantity, medicine_id FROM order_items WHERE order_id = $1',
            [id]
        );

        // Check if pharmacy_inventory has dispensed_today column before updating
        const hasDispensedCol = await client.query<{ exists: boolean }>(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'pharmacy_inventory' AND column_name = 'dispensed_today'
            ) AS exists
        `);

        if (hasDispensedCol.rows[0].exists && itemsResult.rows.length > 0) {
            for (const item of itemsResult.rows) {
                await client.query(`
                    UPDATE pharmacy_inventory
                    SET
                        stock_quantity = GREATEST(stock_quantity - $1, 0),
                        dispensed_today = dispensed_today + $1,
                        updated_at = NOW()
                    WHERE medicine_id = $2 AND pharmacy_id = $3
                `, [item.quantity, item.medicine_id, order.pharmacy_id]);
            }
        }

        // Update order status
        await client.query(
            'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
            ['Approved', id]
        );

        await client.query('COMMIT');
        return sendResponse(res, 200, true, 'Order approved successfully', { orderId: id });
    } catch (error: unknown) {
        await client.query('ROLLBACK');
        logger.error('[Pharmacist] Error approving order:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        return sendError(res, 500, 'Error approving order');
    } finally {
        client.release();
    }
};
export const addInventory = async (req: Request, res: Response): Promise<void> => {
    const { name, category, price, stock, minStock, expiryDate } = req.body;

    if (!name || !price || stock === undefined) {
        return sendError(res, 400, 'Missing required fields: name, price, and stock are mandatory.');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Step 1: Ensure medicine exists (Institutional master list sync)
        const medicineResult = await client.query<{ id: number }>(
            'SELECT id FROM medicines WHERE LOWER(name) = LOWER($1)',
            [name]
        );

        let medicineId: number;

        if (medicineResult.rowCount === 0) {
            // Create new medicine entry
            const newMed = await client.query<{ id: number }>(
                'INSERT INTO medicines (name, category, price_per_unit) VALUES ($1, $2, $3) RETURNING id',
                [name, category || 'General', price]
            );
            medicineId = newMed.rows[0].id;
            logger.info(`[Pharmacist] Created new master medicine entry: ${name}`);
        } else {
            medicineId = medicineResult.rows[0].id;
        }

        // Step 2: Get a default pharmacy (Demo context: global shared ledger)
        const pharmacyResult = await client.query<{ id: number }>('SELECT id FROM pharmacies LIMIT 1');
        if (pharmacyResult.rowCount === 0) {
            throw new Error('No pharmacies registered in the system.');
        }
        const pharmacyId = pharmacyResult.rows[0].id;

        // Step 3: UPSERT into pharmacy_inventory
        // We handle missing columns gracefully like the getters do
        const columnsCheck = await client.query<{ column_name: string }>(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'pharmacy_inventory'
            AND column_name IN ('reorder_level', 'expiry_date')
        `);
        const existingCols = new Set(columnsCheck.rows.map(r => r.column_name));

        const setClause = [
            'price = EXCLUDED.price',
            'stock_quantity = pharmacy_inventory.stock_quantity + EXCLUDED.stock_quantity',
            'updated_at = NOW()'
        ];
        if (existingCols.has('reorder_level')) setClause.push('reorder_level = EXCLUDED.reorder_level');
        if (existingCols.has('expiry_date')) setClause.push('expiry_date = EXCLUDED.expiry_date');

        const insertCols = ['pharmacy_id', 'medicine_id', 'price', 'stock_quantity'];
        const values = [pharmacyId, medicineId, price, stock];
        const placeholders = ['$1', '$2', '$3', '$4'];

        if (existingCols.has('reorder_level')) {
            insertCols.push('reorder_level');
            values.push(minStock || 10);
            placeholders.push(`$${values.length}`);
        }
        if (existingCols.has('expiry_date')) {
            insertCols.push('expiry_date');
            values.push(expiryDate || null);
            placeholders.push(`$${values.length}`);
        }

        await client.query(`
            INSERT INTO pharmacy_inventory (${insertCols.join(', ')})
            VALUES (${placeholders.join(', ')})
            ON CONFLICT (pharmacy_id, medicine_id) DO UPDATE
            SET ${setClause.join(', ')}
        `, values);

        await client.query('COMMIT');
        logger.info(`[Pharmacist] Inventory updated for medicine ID ${medicineId}: +${stock} units`);
        
        return sendResponse(res, 201, true, 'Inventory updated successfully');
    } catch (error: unknown) {
        await client.query('ROLLBACK');
        logger.error('[Pharmacist] Error adding inventory:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        return sendError(res, 500, 'Error updating inventory ledger');
    } finally {
        client.release();
    }
};
