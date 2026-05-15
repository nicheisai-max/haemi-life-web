import api, { normalizeResponse } from './api';
import type { ApiResponse } from '../types/auth.types';

/**
 * 🩺 HAEMI LIFE — CLINICAL COPILOT ADMIN SERVICE (AI cost-control)
 *
 * Two wire calls:
 *
 *   GET  /api/platform/clinical-copilot-enabled   (any authenticated role)
 *   PUT  /api/admin/settings/clinical-copilot-enabled   (admin-only)
 *
 * The asymmetry is deliberate: every role's UI needs to READ this
 * flag (so a doctor's chat input renders disabled when the admin
 * has flipped the kill switch); only admin can WRITE it. The
 * backend `requireRole('admin')` middleware enforces the write
 * scope — this client doesn't need a separate guard.
 *
 * Strict-TS posture: zero `any`, zero `as unknown as`, zero
 * `@ts-ignore`. The wire envelope passes through `normalizeResponse`
 * which structurally narrows the response shape.
 */

export interface ClinicalCopilotEnabledResponse {
    readonly enabled: boolean;
}

/**
 * GET — open to any authenticated role. Returns the current state
 * of the kill switch. Defaults to `true` server-side when no row
 * exists (backward compatible with pre-toggle deployments).
 */
export const getClinicalCopilotEnabled = async (): Promise<boolean> => {
    const response = await api.get<ApiResponse<ClinicalCopilotEnabledResponse>>(
        '/platform/clinical-copilot-enabled'
    );
    return normalizeResponse(response).enabled;
};

/**
 * PUT — admin-only. The server validates `enabled` is a boolean,
 * audit-logs the transition with `priorEnabled` + `newEnabled` +
 * admin user ID + IP + UA, invalidates the 5-min config cache, and
 * emits `'clinical-copilot:toggled'` to every connected socket so
 * doctors' open tabs flip in real time.
 */
export const updateClinicalCopilotEnabled = async (enabled: boolean): Promise<boolean> => {
    const response = await api.put<ApiResponse<ClinicalCopilotEnabledResponse>>(
        '/admin/settings/clinical-copilot-enabled',
        { enabled }
    );
    return normalizeResponse(response).enabled;
};
