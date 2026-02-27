import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'haemi_life',
    password: process.env.DB_PASSWORD || 'password',
    port: parseInt(process.env.DB_PORT || '5432'),
    // Production Hardening: Explicit Pool Constraints
    max: 20, // Max concurrent connections
    idleTimeoutMillis: 30000, // Close idle clients after 30s
    connectionTimeoutMillis: 2000, // Fail fast if connection cannot be established
});

// Task 1: Pool Error Listener
pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client:', err.message);
});
