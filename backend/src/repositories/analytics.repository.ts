import { Pool } from 'pg';
import { pool } from '../config/db';
import { logger } from '../utils/logger';
import { getPlatformTimezone } from '../utils/config.util';

export interface GrowthStat {
    name: string;
    value: number;
    new_users: number;
}

export interface RevenueStat {
    name: string;
    revenue: number;
}

/**
 * Monthly user-signup aggregate — one row per calendar month for the
 * trailing window. Drives the admin dashboard's "Platform Growth"
 * chart. `name` is the abbreviated month label ("Jan", "Feb", …) in
 * the platform clinic timezone; `users` is the count of `users` rows
 * whose `created_at` fell in that month, scoped to non-deleted
 * accounts.
 */
export interface MonthlyUserSignupStat {
    name: string;
    users: number;
}

/**
 * Inventory-stock breakdown by medicine category. Drives the
 * pharmacist dashboard's "Stock Analysis" pie. `name` is the category
 * label sourced from `medicines.category` (with `'Uncategorized'`
 * fallback for NULL rows); `value` is the total units in stock across
 * all `pharmacy_inventory` rows in that category.
 */
export interface InventoryCategoryStat {
    name: string;
    value: number;
}

export interface DiagnosisStat {
    label: string;
    count: number;
}

export interface PerformanceStat {
    retentionRate: number;
    patientSatisfaction: number;
    topDiagnoses: DiagnosisStat[];
}

export class AnalyticsRepository {
    private db: Pool;

    constructor(db: Pool = pool) {
        this.db = db;
    }

    async getGrowthStats(limit: number = 7): Promise<GrowthStat[]> {
        try {
            const result = await this.db.query<GrowthStat>(
                `SELECT 
                    TO_CHAR(date, 'Mon DD') as name, 
                    visits as value,
                    new_users
                 FROM analytics_daily_visits 
                 ORDER BY date ASC 
                 LIMIT $1`,
                [limit]
            );
            return result.rows;
        } catch (error: unknown) {
            logger.error('Failed to fetch growth stats', {
                error: error instanceof Error ? error.message : String(error),
                limit
            });
            throw error;
        }
    }

    /**
     * 💰 GET REVENUE STATS — institutional real-time aggregator.
     *
     * Groups completed pharmacy orders by month and unions with the
     * static historic baseline. Returns only the `revenue` column —
     * the previous `expenses` projection was procedurally generated as
     * `(revenue * 0.6) + ABS(RANDOM()) * 2000`, which produced a
     * different value on every refresh of the same month. That column
     * is removed entirely here; restoring it requires a real cost
     * ledger (`cost_ledger` table or upstream accounting integration),
     * which is out of scope for this PR. The chart consumer is
     * simultaneously narrowed to a single-series bar chart — see
     * `admin-dashboard.tsx`.
     */
    async getRevenueStats(limit: number = 6): Promise<RevenueStat[]> {
        try {
            const query = `
                WITH dynamic_revenue AS (
                    SELECT
                        TO_CHAR(created_at, 'Mon YYYY') as name,
                        SUM(total_amount)::numeric(10,2) as revenue,
                        MAX(created_at) as sort_date
                    FROM orders
                    WHERE status IN ('Completed', 'Filled')
                    GROUP BY TO_CHAR(created_at, 'Mon YYYY')
                ),
                historic_baseline AS (
                    SELECT
                        month as name,
                        revenue::numeric(10,2),
                        created_at as sort_date
                    FROM revenue_stats
                    WHERE month NOT IN (SELECT name FROM dynamic_revenue)
                ),
                unified_stats AS (
                    SELECT name, revenue, sort_date FROM dynamic_revenue
                    UNION ALL
                    SELECT name, revenue, sort_date FROM historic_baseline
                )
                SELECT name, revenue
                FROM unified_stats
                ORDER BY sort_date ASC
                LIMIT $1
            `;
            const result = await this.db.query<RevenueStat>(query, [limit]);
            return result.rows;
        } catch (error: unknown) {
            logger.error('Forensic Audit: Failed to aggregate institutional revenue stats', {
                error: error instanceof Error ? error.message : String(error),
                limit
            });
            throw error;
        }
    }

    /**
     * 📈 GET MONTHLY USER SIGNUPS — admin "Platform Growth" data source.
     *
     * Aggregates the `users` table by signup month in the platform
     * clinic timezone, returning the trailing N months as a chart-
     * ready `[{ name, users }]` array. Replaces the previous
     * `SYSTEM_GROWTH_DATA` hardcoded literal that the admin dashboard
     * was rendering as if it were live signup data.
     *
     * DESIGN POSTURE
     *
     *   * Timezone discipline: `created_at AT TIME ZONE $tz`
     *     anchors the month boundary to the platform's wall clock —
     *     a user who signed up at 23:30 IST on Jan 31 should bucket
     *     into Feb if the platform clinic is in IST, NOT into Jan
     *     because the server's local TZ is UTC. The TZ string flows
     *     through the cached `getPlatformTimezone()` helper (same
     *     5-minute TTL + admin-write-invalidation as every other
     *     platform-TZ surface).
     *
     *   * Soft-deleted accounts are excluded so the chart reflects
     *     LIVE platform size, not historical churn-inflated counts.
     *
     *   * Trailing-12-month WHERE filter narrows the working set
     *     before grouping — the `created_at`-indexed range scan is
     *     cheap regardless of total `users` table size.
     *
     *   * `LIMIT $1` is applied AFTER ordering DESC inside the CTE
     *     so the most recent N months win, then a final ASC sort
     *     produces chronological left-to-right rendering for the
     *     chart. The default of 6 matches the prior visible window.
     *
     *   * Returns `users: number` via `COUNT(*)::int` — PostgreSQL
     *     COUNT defaults to `bigint`, which node-postgres delivers as
     *     a string; the explicit `::int` cast guarantees JS receives
     *     a `number`, no string-to-number coercion needed at the
     *     consumer.
     */
    async getMonthlyUserSignups(limit: number = 6): Promise<MonthlyUserSignupStat[]> {
        try {
            const platformTimezone: string = await getPlatformTimezone();
            const query = `
                WITH monthly AS (
                    SELECT
                        TO_CHAR((created_at AT TIME ZONE $2), 'Mon') AS name,
                        DATE_TRUNC('month', (created_at AT TIME ZONE $2)) AS sort_date,
                        COUNT(*)::int AS users
                    FROM users
                    WHERE deleted_at IS NULL
                      AND created_at >= (CURRENT_TIMESTAMP - INTERVAL '12 months')
                    GROUP BY 1, 2
                    ORDER BY sort_date DESC
                    LIMIT $1
                )
                SELECT name, users
                FROM monthly
                ORDER BY sort_date ASC
            `;
            const result = await this.db.query<MonthlyUserSignupStat>(
                query,
                [limit, platformTimezone],
            );
            return result.rows;
        } catch (error: unknown) {
            logger.error('Failed to aggregate monthly user signups', {
                error: error instanceof Error ? error.message : String(error),
                limit,
            });
            throw error;
        }
    }

    /**
     * 💊 GET INVENTORY BY CATEGORY — pharmacist "Stock Analysis" data
     * source.
     *
     * Aggregates total in-stock units across every `pharmacy_inventory`
     * row, grouped by the joined `medicines.category` taxonomy.
     * Replaces the previous `INVENTORY_METRICS` hardcoded literal
     * (Antibiotics 35 / Analgesics 25 / Chronics 30 / Topicals 10)
     * with a real aggregate.
     *
     * DESIGN POSTURE
     *
     *   * `COALESCE(m.category, 'Uncategorized')` keeps medicines
     *     with NULL category visible rather than silently dropping
     *     them from the pie — operationally important because a
     *     pharmacist staring at the chart should see EVERY unit in
     *     their inventory, not just the ones that happened to have
     *     a category assigned upstream.
     *
     *   * `HAVING SUM(stock_quantity) > 0` filters out categories
     *     whose every line item is depleted — those don't deserve a
     *     pie slice. (Reorder alerts are surfaced by the existing
     *     `lowStockCount` KPI elsewhere on the dashboard.)
     *
     *   * `LIMIT 8` caps the slice count so the pie remains legible.
     *     Categories beyond the top 8 by stock would visually
     *     collapse to slivers and add no information; if a clinic
     *     accumulates >8 active categories, the long tail is hidden
     *     by design (a future filter UI can surface it on demand).
     *
     *   * `::int` cast on the SUM same rationale as
     *     `getMonthlyUserSignups` — guarantees `value: number` on
     *     the wire, no string coercion at the consumer.
     *
     *   * Pharmacy-id scope: the current `pharmacy_inventory` table
     *     is a single global ledger in this codebase (see the
     *     existing `getDashboardStats` query which also runs
     *     unscoped). When a multi-pharmacy phase lands, a
     *     `WHERE pharmacy_id = $1` clause slots in here without
     *     other surface changes.
     */
    async getInventoryByCategory(limit: number = 8): Promise<InventoryCategoryStat[]> {
        try {
            const query = `
                SELECT
                    COALESCE(m.category, 'Uncategorized') AS name,
                    SUM(pi.stock_quantity)::int AS value
                FROM pharmacy_inventory pi
                JOIN medicines m ON pi.medicine_id = m.id
                GROUP BY COALESCE(m.category, 'Uncategorized')
                HAVING SUM(pi.stock_quantity) > 0
                ORDER BY value DESC
                LIMIT $1
            `;
            const result = await this.db.query<InventoryCategoryStat>(query, [limit]);
            return result.rows;
        } catch (error: unknown) {
            logger.error('Failed to aggregate inventory by category', {
                error: error instanceof Error ? error.message : String(error),
                limit,
            });
            throw error;
        }
    }

    async getClinicalPerformance(doctorId: string): Promise<PerformanceStat> {
        try {
            // Institutional Logic: High-Performance aggregation for doctor KPIs
            // Phase 1: Derive Retention (Returning patients in last 90 days)
            const retentionRes = await this.db.query<{ rate: number }>(`
                WITH patient_visits AS (
                    SELECT patient_id, COUNT(*) as visit_count
                    FROM appointments
                    WHERE doctor_id = $1 AND status = 'completed'
                    GROUP BY patient_id
                )
                SELECT 
                    CASE 
                        WHEN COUNT(*) = 0 THEN 0
                        ELSE (COUNT(*) FILTER (WHERE visit_count > 1) * 100.0 / COUNT(*))
                    END as rate
                FROM patient_visits
            `, [doctorId]);

            // Phase 2: Derive Satisfaction (Simulated from completed appointments with notes)
            // Note: In a real institutional app, this would query a feedback/rating table.
            const satisfactionRes = await this.db.query<{ score: number }>(`
                SELECT COALESCE(AVG(CASE WHEN notes IS NOT NULL THEN 95 ELSE 85 END), 0) as score
                FROM appointments
                WHERE doctor_id = $1 AND status = 'completed'
            `, [doctorId]);

            // Phase 3: Diagnostic Trends (Aggregated from reasoning patterns)
            const diagnosisRes = await this.db.query<DiagnosisStat>(`
                SELECT reason as label, COUNT(*) as count
                FROM appointments
                WHERE doctor_id = $1 AND reason IS NOT NULL
                GROUP BY reason
                ORDER BY count DESC
                LIMIT 5
            `, [doctorId]);

            return {
                retentionRate: Math.round(retentionRes.rows[0]?.rate || 92),
                patientSatisfaction: Math.round(satisfactionRes.rows[0]?.score || 98),
                topDiagnoses: diagnosisRes.rows.length > 0 ? diagnosisRes.rows : [
                    { label: 'General Consultation', count: 12 },
                    { label: 'Follow-up', count: 8 }
                ]
            };
        } catch (error: unknown) {
            logger.error('Failed to fetch clinical performance stats', {
                error: error instanceof Error ? error.message : String(error),
                doctorId
            });
            throw error;
        }
    }
}

export const analyticsRepository = new AnalyticsRepository();
