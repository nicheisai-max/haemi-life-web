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
 * 🛡️ HAEMI LIFE — CLINICAL COPILOT KILL SWITCH (AI cost-control)
 *
 * Returns whether the Clinical AI Copilot is currently enabled. Read
 * by every endpoint under `/api/clinical-copilot/*` to gate the
 * Gemini dispatch — when `false`, the backend refuses the request
 * with HTTP 403 + structured code `COPILOT_DISABLED` and zero
 * Gemini API calls are issued.
 *
 * Stored as the string `'true'` under
 * `system_settings.clinical_copilot_enabled`. ANY other value
 * (`'false'`, empty, malformed) coerces to `false` — defensive: a
 * manual SQL update that wrote `'yes'` or `'enabled'` won't
 * accidentally re-enable the API.
 *
 * Cached for 5 minutes (matches the established session-timeout /
 * JWT-expiry pattern). The admin PATCH endpoint calls
 * `invalidateStringConfigCache('clinical_copilot_enabled')` after a
 * successful write so the change is observable on the very next
 * request, not 5 minutes later.
 *
 * Failure-safe: a DB error returns `true` (the institutional
 * default) — we'd rather degrade open than close a working
 * production feature for a transient network blip. The admin can
 * still flip it OFF the moment they notice.
 */
export async function getClinicalCopilotEnabled(): Promise<boolean> {
    const key = 'clinical_copilot_enabled';
    const now = Date.now();

    if (stringConfigCache[key] && stringConfigCache[key].expires > now) {
        return stringConfigCache[key].value === 'true';
    }

    try {
        const result = await pool.query<{ value: string }>(
            'SELECT value FROM system_settings WHERE key = $1 LIMIT 1',
            [key]
        );
        const raw: string = typeof result.rows[0]?.value === 'string'
            ? result.rows[0].value
            : 'true';

        stringConfigCache[key] = { value: raw, expires: now + CACHE_TTL };
        return raw === 'true';
    } catch {
        // DB blip — degrade open. Cached value (if any) wins;
        // otherwise institutional default `true`.
        const fallback: string = stringConfigCache[key]?.value ?? 'true';
        return fallback === 'true';
    }
}

/**
 * HAEMI LIFE — PRE-SCREENING RISK CALCULATION MODE (Enterprise Hardening)
 *
 * Returns the platform-wide risk calculation mode (`'ai'` or `'manual'`)
 * stored under `system_settings.pre_screening_risk_calculation_mode`.
 * Cached for 5 minutes (matches the established session-timeout /
 * JWT-expiry pattern) so the patient-submit hot path doesn't pay a
 * per-request DB round-trip for what is effectively a static admin
 * decision.
 *
 * Cache invalidation hook: the admin PUT endpoint calls
 * `invalidateStringConfigCache('pre_screening_risk_calculation_mode')`
 * after a successful write, so the change is observable on the very
 * next request, never 5 minutes later.
 *
 * Defensive cascade (matches `getClinicalCopilotEnabled`):
 *   * Row absent           -> institutional default `'manual'` (existing
 *                              behaviour, backward-compatible)
 *   * Row present but not
 *     a known mode value   -> institutional default `'manual'`
 *   * Query failure        -> last-cached value, else institutional default
 */
export type RiskCalculationMode = 'ai' | 'manual';
const DEFAULT_RISK_CALCULATION_MODE: RiskCalculationMode = 'manual';

const isRiskCalculationMode = (value: string): value is RiskCalculationMode => {
    return value === 'ai' || value === 'manual';
};

export async function getPreScreeningRiskMode(): Promise<RiskCalculationMode> {
    const key = 'pre_screening_risk_calculation_mode';
    const now = Date.now();

    if (stringConfigCache[key] && stringConfigCache[key].expires > now) {
        const cached: string = stringConfigCache[key].value;
        return isRiskCalculationMode(cached) ? cached : DEFAULT_RISK_CALCULATION_MODE;
    }

    try {
        const result = await pool.query<{ value: string }>(
            'SELECT value FROM system_settings WHERE key = $1 LIMIT 1',
            [key]
        );
        const raw: string | undefined = result.rows[0]?.value;
        const candidate: string = typeof raw === 'string' && raw.length > 0
            ? raw
            : DEFAULT_RISK_CALCULATION_MODE;
        const val: RiskCalculationMode = isRiskCalculationMode(candidate)
            ? candidate
            : DEFAULT_RISK_CALCULATION_MODE;

        stringConfigCache[key] = { value: val, expires: now + CACHE_TTL };
        return val;
    } catch {
        const fallback: string = stringConfigCache[key]?.value ?? DEFAULT_RISK_CALCULATION_MODE;
        return isRiskCalculationMode(fallback) ? fallback : DEFAULT_RISK_CALCULATION_MODE;
    }
}

/**
 * HAEMI LIFE — PRE-SCREENING HIGH-RISK THRESHOLD (Enterprise Hardening)
 *
 * Returns the platform-wide high-risk classification threshold in
 * `[0, 1]`. The repository compares `normalisedRisk` against this
 * value to decide between the `'completed'` and `'high-risk'`
 * appointment statuses. Previously hardcoded as `0.7` in
 * `pre-screening.repository.ts`; lifted here so admins can tune the
 * clinical posture without a deploy.
 *
 * Cached for 5 minutes; admin PUT endpoint invalidates on write.
 *
 * Defensive cascade:
 *   * Row absent                  -> institutional default `0.7`
 *   * Row present but non-numeric -> institutional default `0.7`
 *   * Value out of `[0, 1]`       -> clamped into range
 *   * Query failure               -> last-cached value, else default
 */
export const DEFAULT_HIGH_RISK_THRESHOLD: number = 0.7;

const clampUnitInterval = (n: number): number => {
    if (!Number.isFinite(n)) return DEFAULT_HIGH_RISK_THRESHOLD;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
};

export async function getPreScreeningHighRiskThreshold(): Promise<number> {
    const key = 'pre_screening_high_risk_threshold';
    const now = Date.now();

    if (stringConfigCache[key] && stringConfigCache[key].expires > now) {
        const parsed: number = Number.parseFloat(stringConfigCache[key].value);
        return Number.isFinite(parsed) ? clampUnitInterval(parsed) : DEFAULT_HIGH_RISK_THRESHOLD;
    }

    try {
        const result = await pool.query<{ value: string }>(
            'SELECT value FROM system_settings WHERE key = $1 LIMIT 1',
            [key]
        );
        const raw: string | undefined = result.rows[0]?.value;
        if (typeof raw !== 'string' || raw.length === 0) {
            stringConfigCache[key] = { value: String(DEFAULT_HIGH_RISK_THRESHOLD), expires: now + CACHE_TTL };
            return DEFAULT_HIGH_RISK_THRESHOLD;
        }
        const parsed: number = Number.parseFloat(raw);
        const val: number = Number.isFinite(parsed)
            ? clampUnitInterval(parsed)
            : DEFAULT_HIGH_RISK_THRESHOLD;

        stringConfigCache[key] = { value: String(val), expires: now + CACHE_TTL };
        return val;
    } catch {
        const cachedRaw: string | undefined = stringConfigCache[key]?.value;
        if (typeof cachedRaw === 'string') {
            const parsed: number = Number.parseFloat(cachedRaw);
            return Number.isFinite(parsed) ? clampUnitInterval(parsed) : DEFAULT_HIGH_RISK_THRESHOLD;
        }
        return DEFAULT_HIGH_RISK_THRESHOLD;
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
