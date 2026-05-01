import { logger } from './logger';

/**
 * Recent-routes ring buffer persisted to localStorage.
 *
 * Purpose: power the "Recent" section of the Command Palette so the user
 * can jump back to the last few pages they visited without having to
 * remember the route name. Mirrors the Linear / Notion / VS Code pattern.
 *
 * Design choices:
 *
 *   - Bounded at `RECENT_ROUTES_LIMIT` (most-recent-first, FIFO eviction)
 *     so the storage footprint stays trivial regardless of session length.
 *
 *   - Stored as a JSON array of plain `{ path, ts }` objects — schema is
 *     intentionally narrow so a forward-compatible migration is a simple
 *     `Array.isArray` + `.filter(isRecentEntry)` step.
 *
 *   - All catch blocks bind `error: unknown` and narrow with `instanceof
 *     Error`. No double casts, no `any`, no suppressions.
 *
 *   - Read-side is total: `getRecentRoutes` always returns an array, never
 *     throws, so callers can treat it as a pure value.
 */

const STORAGE_KEY = 'haemi-cmdk-recent-v1';
const RECENT_ROUTES_LIMIT = 8;

export interface RecentRouteEntry {
    readonly path: string;
    readonly visitedAt: number;
}

const isRecentEntry = (value: unknown): value is RecentRouteEntry => {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as { path: unknown; visitedAt: unknown };
    return typeof obj.path === 'string' && typeof obj.visitedAt === 'number';
};

const safeRead = (): RecentRouteEntry[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === null) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isRecentEntry);
    } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : String(error);
        logger.warn('[RecentRoutes] read failed; resetting to empty', { error: detail });
        return [];
    }
};

const safeWrite = (entries: readonly RecentRouteEntry[]): void => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : String(error);
        logger.warn('[RecentRoutes] write failed; storage full or denied', { error: detail });
    }
};

/**
 * Returns the recent-routes ring buffer ordered most-recent first.
 * Always returns an array — never throws.
 */
export const getRecentRoutes = (): RecentRouteEntry[] => safeRead();

/**
 * Records a route visit. Pushes the path to the front of the buffer,
 * de-duplicates any prior occurrence (so the same page isn't listed
 * twice), and trims to `RECENT_ROUTES_LIMIT`. Idempotent for repeated
 * calls in a single tick.
 */
export const recordRouteVisit = (path: string): void => {
    if (!path || path === '/') return;
    const existing = safeRead();
    const deduped = existing.filter(entry => entry.path !== path);
    const next: RecentRouteEntry[] = [
        { path, visitedAt: Date.now() },
        ...deduped,
    ].slice(0, RECENT_ROUTES_LIMIT);
    safeWrite(next);
};

/**
 * Clears the recent-routes buffer. Called by the auth-context on logout
 * so the next user does not inherit the previous session's history.
 */
export const clearRecentRoutes = (): void => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : String(error);
        logger.warn('[RecentRoutes] clear failed', { error: detail });
    }
};
