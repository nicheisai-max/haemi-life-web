import { pool } from '../config/db';

// Simple in-memory cache to prevent DB pool exhaustion during high-frequency auth checks
const configCache: Record<string, { value: number; expires: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches the session timeout from system_settings.
 * Defaults to 60 minutes if not configured.
 */
export async function getSessionTimeoutMinutes(): Promise<number> {
    const key = 'SESSION_TIMEOUT_MINUTES';
    const now = Date.now();
    
    if (configCache[key] && configCache[key].expires > now) {
        return configCache[key].value;
    }

    try {
        const result = await pool.query("SELECT value FROM system_settings WHERE key = $1 LIMIT 1", [key]);
        const val = result.rows.length === 0 ? 60 : parseInt(result.rows[0].value, 10);
        
        if (isNaN(val)) throw new Error(`Invalid ${key} value in DB`);
        
        configCache[key] = { value: val, expires: now + CACHE_TTL };
        return val;
    } catch (error) {
        console.error(`[Config] Error fetching ${key}:`, error);
        return configCache[key]?.value || 60; // Fallback to cache or default
    }
}

/**
 * Fetches the JWT access token expiry in seconds.
 */
export async function getJwtAccessExpiry(): Promise<number> {
    const key = 'JWT_ACCESS_EXPIRY_MINUTES';
    const now = Date.now();

    if (configCache[key] && configCache[key].expires > now) {
        return configCache[key].value;
    }

    try {
        const result = await pool.query("SELECT value FROM system_settings WHERE key = $1 LIMIT 1", [key]);
        const minutes = result.rows.length === 0 ? 15 : parseInt(result.rows[0].value, 10);
        const val = minutes * 60;

        configCache[key] = { value: val, expires: now + CACHE_TTL };
        return val;
    } catch {
        return 15 * 60;
    }
}

/**
 * Fetches the JWT refresh token expiry in seconds.
 */
export async function getJwtRefreshExpiry(): Promise<number> {
    const key = 'JWT_REFRESH_EXPIRY_DAYS';
    const now = Date.now();

    if (configCache[key] && configCache[key].expires > now) {
        return configCache[key].value;
    }

    try {
        const result = await pool.query("SELECT value FROM system_settings WHERE key = $1 LIMIT 1", [key]);
        const days = result.rows.length === 0 ? 7 : parseInt(result.rows[0].value, 10);
        const val = days * 24 * 60 * 60;

        configCache[key] = { value: val, expires: now + CACHE_TTL };
        return val;
    } catch {
        return 7 * 24 * 60 * 60;
    }
}
