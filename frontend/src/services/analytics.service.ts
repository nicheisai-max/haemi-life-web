import api, { normalizeResponse } from './api';
import type { ApiResponse } from '../types/auth.types';

// ─── Backend Contract Types (Internal — DO NOT export to components) ──────────
//
// These types mirror the EXACT shape of the backend AnalyticsRepository response.
// They are intentionally `readonly` to prevent mutation after deserialization.
//
// IMPORTANT: If the backend schema changes, update ONLY these types and the
// normalization adapters below. Component-facing types must never drift.

interface RawDiagnosisStat {
    readonly label: string;  // Backend column alias: `reason as label`
    readonly count: number;
}

interface RawClinicalPerformance {
    readonly retentionRate: number | string;
    readonly patientSatisfaction: number | string;
    readonly topDiagnoses: RawDiagnosisStat[];
}

// ─── Frontend Contract Types (Exported — Safe for all components) ─────────────
//
// These are the canonical, normalized types consumed by all frontend components.
// They represent a stable public API that components can depend on.

export interface GrowthStat {
    name: string;
    value: number;
    newUsers?: number;
    [key: string]: string | number | undefined;
}

export interface DiagnosisEntry {
    /** Normalized from backend `label` (was: `reason as label` in SQL) */
    readonly name: string;
    readonly count: number;
    /** Relative percentage (0–100), normalized against the highest-count entry */
    readonly percentage: number;
}

export interface ClinicalPerformance {
    retentionRate?: string | number;
    patientSatisfaction?: string | number;
    topDiagnoses?: DiagnosisEntry[];
}

// ─── Normalization Adapters ───────────────────────────────────────────────────
//
// The normalization boundary ensures that backend schema changes never reach
// the component layer. All field renames and computed fields are handled here.

/**
 * Normalizes a raw `RawDiagnosisStat[]` from the backend into `DiagnosisEntry[]`.
 *
 * Transformations applied:
 *  1. `label` → `name`    : Resolves the field name drift between repository and components.
 *  2. `percentage` (computed): Relative to the highest-count diagnosis (max = 100%).
 *     This approach ensures the top diagnosis always fills its bar completely,
 *     providing a visually meaningful distribution (standard medical dashboard pattern).
 *
 * @param raw - The raw array returned by the backend AnalyticsRepository.
 * @returns A stable, normalized array safe for direct component consumption.
 */
const normalizeDiagnoses = (raw: RawDiagnosisStat[]): DiagnosisEntry[] => {
    if (!raw || raw.length === 0) return [];

    const counts = raw.map(d => Number(d.count));
    const maxCount = Math.max(...counts);
    if (maxCount === 0) return [];

    return raw.map(d => ({
        name: d.label,
        count: Number(d.count),
        percentage: Math.round((Number(d.count) / maxCount) * 100),
    }));
};

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Fetches clinical volume growth stats (daily visits trend).
 * RBAC: accessible by `doctor` and `admin`.
 */
export const getGrowthStats = async (): Promise<GrowthStat[]> => {
    const response = await api.get<ApiResponse<GrowthStat[]>>('/analytics/growth');
    return normalizeResponse(response);
};

/**
 * Fetches clinical KPI performance metrics for the authenticated doctor.
 * RBAC: `doctor` only — data is scoped to `req.user.id` at the repository layer.
 *
 * The raw backend response is normalized at this boundary:
 *  - `topDiagnoses[].label` → `topDiagnoses[].name`
 *  - `topDiagnoses[].percentage` computed from relative counts
 */
export const getClinicalPerformance = async (): Promise<ClinicalPerformance> => {
    const response = await api.get<ApiResponse<RawClinicalPerformance>>('/analytics/performance');
    const raw = normalizeResponse(response);

    return {
        retentionRate: raw.retentionRate,
        patientSatisfaction: raw.patientSatisfaction,
        topDiagnoses: normalizeDiagnoses(raw.topDiagnoses ?? []),
    };
};

export default {
    getGrowthStats,
    getClinicalPerformance,
};
