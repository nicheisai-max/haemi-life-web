import api, { normalizeResponse } from './api';
import type { ApiResponse } from '../types/auth.types';

/**
 * 🌍 HAEMI LIFE — PLATFORM SERVICE (Phase 5 — Timezone Sovereignty)
 *
 * Wraps the platform-wide endpoints. Every authenticated role can READ
 * the platform timezone (so dates render correctly across the app);
 * only the admin role can WRITE it (the admin-only mount in
 * `backend/src/routes/platform.routes.ts` enforces the role check via
 * middleware — the client never has to know).
 *
 * Strict-TS posture: zero `any`, zero `as unknown as`, zero `@ts-ignore`.
 * All wire responses pass through `normalizeResponse` which structurally
 * narrows the envelope.
 */

export interface PlatformTimezoneResponse {
    readonly platformTimezone: string;
}

/**
 * GET /api/platform/timezone — Open to any authenticated role.
 * Returns the canonical platform-wide IANA timezone the admin has set
 * (or the institutional default if never explicitly set).
 */
export const getPlatformTimezone = async (): Promise<PlatformTimezoneResponse> => {
    const response = await api.get<ApiResponse<PlatformTimezoneResponse>>('/platform/timezone');
    return normalizeResponse(response);
};

/**
 * PATCH /api/admin/platform/timezone — Admin-only.
 * Server-side `requireRole('admin')` middleware rejects non-admin
 * callers with a 403; the controller validates IANA, audit-logs the
 * transition, persists, and broadcasts `'platform-timezone:updated'`
 * to every connected socket so every role's UI refreshes in real time.
 */
export const updatePlatformTimezone = async (timezone: string): Promise<PlatformTimezoneResponse> => {
    const response = await api.patch<ApiResponse<PlatformTimezoneResponse>>(
        '/admin/platform/timezone',
        { timezone }
    );
    return normalizeResponse(response);
};
