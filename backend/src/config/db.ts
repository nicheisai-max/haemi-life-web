import './env';
import { Pool, types } from 'pg';
import { logger } from '../utils/logger';

/**
 * 🛡️ HAEMI LIFE — pg NUMERIC Global Type Parser (Phase 12 P1 Architectural Fix)
 *
 * Background
 * ----------
 * `node-postgres` returns NUMERIC / DECIMAL columns as JavaScript strings
 * by default to preserve arbitrary precision. In an institutional codebase
 * that mixes 38 tables across pharmacy, prescriptions, analytics, and
 * clinical risk scoring, this default silently broke arithmetic in seven
 * distinct query sites (pharmacy_inventory.price, orders.total_amount,
 * medicines.price_per_unit, pre_screening_definitions.risk_weight,
 * appointment_pre_screenings.risk_score, locations.gps_latitude/longitude,
 * revenue_stats.revenue/expenses) where downstream code performed `+=`
 * arithmetic on string-typed values, producing concatenation rather than
 * addition.
 *
 * Fix
 * ----
 * Register a single global parser for OID 1700 (NUMERIC) that converts
 * the raw string into a JavaScript number, returning `null` when the
 * value is missing or malformed (the latter cannot occur for a healthy
 * NUMERIC column but is treated defensively to keep callers strict).
 *
 * Boundary
 * --------
 * Haemi Life's largest NUMERIC precision is `numeric(12,4)` for revenue
 * stats — well within JavaScript's `Number.MAX_SAFE_INTEGER` envelope.
 * If the schema ever introduces a NUMERIC column whose magnitude or
 * precision exceeds 15 significant digits, that specific column must
 * be parsed back to a string at the call site (we do not currently
 * have such a column).
 */
const NUMERIC_OID = 1700;
types.setTypeParser(NUMERIC_OID, (raw: string): number | null => {
    if (raw === null || raw === undefined) return null;
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : null;
});

/**
 * 🛡️ HAEMI LIFE — pg TIMESTAMP UTC Parser (Phase 12 P1 Architectural Fix)
 *
 * Problem
 * -------
 * The schema mixes TIMESTAMP (no time zone) and TIMESTAMPTZ (with time zone)
 * columns across `active_connections`, `users`, `appointments`, and several
 * other tables. By default, `node-postgres` parses naive TIMESTAMP values
 * using the Node process's local timezone. When the Node and Postgres
 * processes are on different machines or use different TZ environment
 * variables, this produces JS Date objects that are off by the timezone
 * offset — undetectable in code and silently breaks comparisons.
 *
 * Fix
 * ---
 * Register a parser for OID 1114 that interprets every TIMESTAMP value
 * as UTC. The repository writes use `CURRENT_TIMESTAMP` and `NOW()`,
 * which Postgres already evaluates in UTC for TIMESTAMPTZ. Forcing the
 * read side to also treat TIMESTAMP as UTC produces a single canonical
 * temporal frame across the application: every Date object the API
 * yields represents an absolute moment in UTC, regardless of where the
 * Node process happens to run.
 *
 * Boundary
 * --------
 * The frontend formats Dates for display via `Intl.DateTimeFormat` /
 * `date-fns` with explicit user locale; this fix does not change display
 * behavior, only the interpretation of the wire value coming out of pg.
 */
const TIMESTAMP_OID = 1114;
types.setTypeParser(TIMESTAMP_OID, (raw: string): Date | null => {
    if (raw === null || raw === undefined) return null;
    // Postgres's TIMESTAMP wire format omits a TZ designator, so we append
    // 'Z' to force UTC interpretation regardless of Node's local timezone.
    const parsed = new Date(`${raw}Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
});

export const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'haemi_life',
    password: process.env.DB_PASSWORD || 'password',
    port: parseInt(process.env.DB_PORT || '5432'),
    // Production Hardening: Explicit Pool Constraints
    max: 50, // Increased for high-concurrency presence bursts
    idleTimeoutMillis: 30000, // Close idle clients after 30s
    connectionTimeoutMillis: 10000, // Increased for stability during setup
});

// Task 1: Pool Error Listener
pool.on('error', (err) => {
    logger.error('[DB] Unexpected error on idle client:', { error: err.message });
});




/**
 * Verifies database connectivity.
 * Fails fast if connection cannot be established.
 */
export async function checkConnection(): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query('SELECT 1');
    } finally {
        client.release();
    }
}
