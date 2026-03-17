import { pool } from '../config/db';

/**
 * Fetches the session timeout from system_settings.
 * Defaults to 60 minutes if not configured.
 */
export async function getSessionTimeoutMinutes(): Promise<number> {
    try {
        const result = await pool.query("SELECT value FROM system_settings WHERE key = 'SESSION_TIMEOUT_MINUTES' LIMIT 1");
        if (result.rows.length === 0) {
            throw new Error('CRITICAL: SESSION_TIMEOUT_MINUTES missing from database system_settings.');
        }
        const val = parseInt(result.rows[0].value);
        if (isNaN(val)) {
            throw new Error(`CRITICAL: Invalid SESSION_TIMEOUT_MINUTES value in DB: ${result.rows[0].value}`);
        }
        return val;
    } catch (error) {
        console.error('[Config] CRITICAL CONFIG ERROR (SESSION_TIMEOUT):', error);
        throw error;
    }
}

/**
 * Fetches the JWT access token expiry in seconds.
 */
export async function getJwtAccessExpiry(): Promise<number> {
    try {
        const result = await pool.query("SELECT value FROM system_settings WHERE key = 'JWT_ACCESS_EXPIRY_MINUTES' LIMIT 1");
        if (result.rows.length === 0) return 15 * 60; // 15 minutes default
        return parseInt(result.rows[0].value, 10) * 60;
    } catch {
        return 15 * 60;
    }
}

/**
 * Fetches the JWT refresh token expiry in seconds.
 */
export async function getJwtRefreshExpiry(): Promise<number> {
    try {
        const result = await pool.query("SELECT value FROM system_settings WHERE key = 'JWT_REFRESH_EXPIRY_DAYS' LIMIT 1");
        if (result.rows.length === 0) return 7 * 24 * 60 * 60; // 7 days default
        return parseInt(result.rows[0].value, 10) * 24 * 60 * 60;
    } catch {
        return 7 * 24 * 60 * 60;
    }
}
