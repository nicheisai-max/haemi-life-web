import { pool } from '../config/db';

/**
 * Fetches the session timeout from system_settings.
 * Defaults to 60 minutes if not configured.
 */
export async function getSessionTimeoutMinutes(): Promise<number> {
    try {
        const result = await pool.query("SELECT value FROM system_settings WHERE key = 'SESSION_TIMEOUT_MINUTES' LIMIT 1");
        if (result.rows.length > 0) {
            const val = parseInt(result.rows[0].value);
            return isNaN(val) ? 60 : val;
        }
    } catch (error) {
        console.error('[Config] Failed to fetch SESSION_TIMEOUT_MINUTES:', error);
    }
    return 60; // Safe default
}
