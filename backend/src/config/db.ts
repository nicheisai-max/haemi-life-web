import './env';
import { Pool } from 'pg';
import { logger } from '../utils/logger';

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
