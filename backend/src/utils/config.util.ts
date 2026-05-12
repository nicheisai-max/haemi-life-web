import { pool } from '../config/db';
import { isValidIanaTimezone, INSTITUTIONAL_DEFAULT_TIMEZONE } from './timezone.utils';

// Simple in-memory cache to prevent DB pool exhaustion during high-frequency auth checks
const configCache: Record<string, { value: number; expires: number }> = {};
// Separate string-typed cache slot for non-numeric configuration values
// (e.g. `PLATFORM_TIMEZONE`). Keeps the existing `configCache` shape
// stable for every caller that depends on `value: number`.
const stringConfigCache: Record<string, { value: string; expires: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Module-level invalidation hook for the string config cache. Called by
 * the platform controller after a successful admin write so the very
 * next read returns the freshly-saved value instead of a stale cached
 * one (the 5-minute TTL would otherwise mask the change end-to-end).
 *
 * Keyed by config key so future string-config helpers can clear their
 * own entry without disturbing others.
 */
export function invalidateStringConfigCache(key: string): void {
    delete stringConfigCache[key];
}

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

/**
 * Phase 5 — Timezone Sovereignty (Platform-Wide).
 *
 * Returns the platform-wide IANA timezone stored under
 * `system_settings.PLATFORM_TIMEZONE`. Replaces the per-doctor
 * `doctor_profiles.clinic_timezone` source for every downstream
 * consumer (slot computation, appointment overdue cron, admin
 * dashboards, etc.).
 *
 * Cached for 5 minutes (matches the established session-timeout /
 * JWT-expiry pattern) so high-frequency read paths — every
 * appointment creation, every slot query, every authenticated
 * request that needs the platform TZ — don't slam the DB. The
 * admin controller's PATCH endpoint calls
 * `invalidateStringConfigCache('PLATFORM_TIMEZONE')` after a
 * successful write so the change is observable on the very next read.
 *
 * Defensive cascade:
 *   • DB row missing            → institutional default
 *   • DB row present but invalid IANA → institutional default
 *     (admin saw a stale row in the picker; we don't silently apply
 *      a bad value to downstream calculations)
 *   • Query failure             → last-cached value or institutional default
 */
export async function getPlatformTimezone(): Promise<string> {
    const key = 'PLATFORM_TIMEZONE';
    const now = Date.now();

    if (stringConfigCache[key] && stringConfigCache[key].expires > now) {
        return stringConfigCache[key].value;
    }

    try {
        const result = await pool.query<{ value: string }>(
            'SELECT value FROM system_settings WHERE key = $1 LIMIT 1',
            [key]
        );
        const raw: string | undefined = result.rows[0]?.value;
        const candidate: string = typeof raw === 'string' && raw.length > 0
            ? raw
            : INSTITUTIONAL_DEFAULT_TIMEZONE;
        const val: string = isValidIanaTimezone(candidate)
            ? candidate
            : INSTITUTIONAL_DEFAULT_TIMEZONE;

        stringConfigCache[key] = { value: val, expires: now + CACHE_TTL };
        return val;
    } catch {
        return stringConfigCache[key]?.value ?? INSTITUTIONAL_DEFAULT_TIMEZONE;
    }
}
