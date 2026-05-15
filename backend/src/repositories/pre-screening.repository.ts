import { Pool, PoolClient } from 'pg';
import { pool } from '../config/db';
import { logger } from '../utils/logger';
import { auditService, SYSTEM_ANONYMOUS_ID } from '../services/audit.service';
import {
    getPreScreeningRiskMode,
    getPreScreeningHighRiskThreshold,
} from '../utils/config.util';
import {
    scoreTriageWithAi,
    TriageAiScorerError,
    type TriageAiQuestionInput,
    type TriageAiResponseInput,
} from '../services/triage-ai-scorer.service';

/**
 * Storage key for the platform-wide risk-calculation-mode setting.
 * Held alongside other `system_settings` rows; default is `'manual'`
 * (existing behaviour) when no row exists yet. Exported so the admin
 * controller can address the row directly when persisting / auditing
 * a flip — runtime reads go through the cached
 * `getPreScreeningRiskMode()` helper in `config.util`.
 */
export const RISK_CALCULATION_MODE_KEY: string = 'pre_screening_risk_calculation_mode';

export type RiskCalculationMode = 'ai' | 'manual';

export const DEFAULT_RISK_CALCULATION_MODE: RiskCalculationMode = 'manual';

/** Type guard for the persisted-value shape. Anything outside the
 *  union (corruption, manual SQL edit, future enum addition) collapses
 *  to the institutional default — patient flow never sees a half-typed
 *  branch. */
export const isRiskCalculationMode = (value: string | null): value is RiskCalculationMode => {
    return value === 'ai' || value === 'manual';
};

/**
 * In-process retry-dedup cache for AI-scored submissions. Keyed by
 * `${appointmentId}:${responseFingerprint}` so a *network retry* with
 * the same payload reuses the prior AI result (no duplicate Gemini
 * billing); a *legitimate resubmission* with different answers
 * naturally bypasses the cache because its fingerprint differs.
 *
 * Bounded by both TTL (60s) and a max-size hard cap (the LRU-ish
 * eviction is performed lazily during writes — the map never holds
 * more than RECENT_SCORE_MAX entries, so a flood of one-off
 * submissions cannot grow it unboundedly). The cache survives only
 * within a single Node.js process; multi-instance deployments do not
 * coordinate, which is acceptable because the worst-case behaviour
 * (a retry hits a different instance and pays one extra Gemini call)
 * is the SAME as the pre-cache baseline.
 */
const RECENT_AI_SCORE_TTL_MS: number = 60_000;
const RECENT_AI_SCORE_MAX: number = 1024;
const recentAiScores: Map<string, { readonly score: number; readonly expires: number }> = new Map();

const computeResponseFingerprint = (responses: ReadonlyArray<PreScreeningResponse>): string => {
    return responses
        .map((r) => `${r.question_id}:${r.response_value ? '1' : '0'}`)
        .sort()
        .join('|');
};

const rememberAiScore = (appointmentId: number, fingerprint: string, score: number): void => {
    if (recentAiScores.size >= RECENT_AI_SCORE_MAX) {
        // Drop the oldest entry. Map preserves insertion order in
        // ES2015+ so `keys().next()` gives us the LRU candidate.
        const oldest = recentAiScores.keys().next().value;
        if (typeof oldest === 'string') recentAiScores.delete(oldest);
    }
    recentAiScores.set(`${appointmentId}:${fingerprint}`, {
        score,
        expires: Date.now() + RECENT_AI_SCORE_TTL_MS,
    });
};

const recallAiScore = (appointmentId: number, fingerprint: string): number | null => {
    const key: string = `${appointmentId}:${fingerprint}`;
    const hit = recentAiScores.get(key);
    if (hit === undefined) return null;
    if (hit.expires <= Date.now()) {
        recentAiScores.delete(key);
        return null;
    }
    return hit.score;
};

export interface PreScreeningDefinition {
    id: string;
    category: 'triage';
    question_text: string;
    disease_tag?: string;
    risk_weight: number;
    is_active: boolean;
    sort_order: number;
}

export interface PreScreeningResponse {
    question_id: string;
    response_value: boolean;
    additional_notes?: string;
    risk_score?: number;
}


export class PreScreeningRepository {
    private db: Pool;

    constructor() {
        this.db = pool;
    }

    /**
     * Institutional Grade: Fetching question definitions with high-performance filtering.
     * Google/Meta Standard: Always filtering by is_active to prevent legacy drift.
     */
    async getDefinitions(category?: 'triage'): Promise<PreScreeningDefinition[]> {
        try {
            let query = 'SELECT * FROM pre_screening_definitions WHERE is_active = true';
            const params: string[] = [];

            if (category) {
                query += ' AND category = $1';
                params.push(category);
            }

            query += ' ORDER BY sort_order ASC';

            const result = await this.db.query<PreScreeningDefinition>(query, params);
            return result.rows;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Failed to fetch pre-screening definitions', { error: errorMessage, category });
            throw error;
        }
    }

    /**
     * Admin Protocol: Create a new screening definition.
     */
    async createDefinition(data: Omit<PreScreeningDefinition, 'id'>): Promise<PreScreeningDefinition> {
        const query = `
            INSERT INTO pre_screening_definitions (category, question_text, disease_tag, risk_weight, sort_order, is_active)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const params = [data.category, data.question_text, data.disease_tag || 'TB', data.risk_weight, data.sort_order, data.is_active];
        const result = await this.db.query<PreScreeningDefinition>(query, params);
        return result.rows[0];
    }

    /**
     * Admin Protocol: Update an existing definition.
     */
    async updateDefinition(id: string, data: Partial<PreScreeningDefinition>): Promise<PreScreeningDefinition | null> {
        const result = await this.db.query<PreScreeningDefinition>(
            'UPDATE pre_screening_definitions SET question_text = COALESCE($1, question_text), risk_weight = COALESCE($2, risk_weight), sort_order = COALESCE($3, sort_order), is_active = COALESCE($4, is_active) WHERE id = $5 RETURNING *',
            [data.question_text, data.risk_weight, data.sort_order, data.is_active, id]
        );
        return result.rows[0] || null;
    }

    /**
     * Institutional Protocol: Permanent deletion of clinical definition.
     * Note: This should be used with caution as it may break history for legacy appointments.
     */
    async deleteDefinition(id: string): Promise<boolean> {
        const result = await this.db.query('DELETE FROM pre_screening_definitions WHERE id = $1', [id]);
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Transactional Integrity: Saving responses and updating appointment status in one atomic block.
     *
     * P0 TYPE FIX (Phase 12): `appointment_id` is `number` to match the
     * INTEGER primary key on `appointments.id` and the FK on
     * `appointment_pre_screenings.appointment_id`. Passing a string here
     * previously relied on Postgres implicit coercion and silently risked
     * mis-matched UPDATE WHERE clauses on hot triage paths.
     *
     * P0 NUMERIC FIX (Phase 12): `risk_weight` is NUMERIC in PostgreSQL,
     * which `node-postgres` returns as a string. Without `Number()` the
     * "+= weight" arithmetic became string concatenation and silently
     * corrupted clinical risk scores.
     */
    async saveResponses(appointment_id: number, userId: string, responses: PreScreeningResponse[]): Promise<{ healthScore: number }> {
        if (!Number.isInteger(appointment_id) || appointment_id <= 0) {
            throw new Error(`Invalid appointment_id: expected positive integer, received ${String(appointment_id)}`);
        }

        // Resolve platform-wide configuration BEFORE the transaction opens.
        // Both lookups are cached in `config.util` (5-min TTL, invalidated
        // on admin write) so the patient submit hot path is a sub-ms hit
        // in the steady state. Failure of either falls back to the
        // institutional default inside the helper itself — patient flow
        // never blocks on a settings-read hiccup.
        const configuredMode: RiskCalculationMode = await getPreScreeningRiskMode();
        const highRiskThreshold: number = await getPreScreeningHighRiskThreshold();

        // Retry-dedup fingerprint computed BEFORE the transaction so a
        // burst-retry shortcut bypasses both the AI call and the DB
        // write churn. Only consulted on AI mode — manual mode is free
        // and idempotent by construction.
        const responseFingerprint: string = computeResponseFingerprint(responses);
        const cachedAiScore: number | null = configuredMode === 'ai'
            ? recallAiScore(appointment_id, responseFingerprint)
            : null;

        const client: PoolClient = await this.db.connect();
        try {
            await client.query('BEGIN');

            // 1. Clear existing responses (if any) for this appointment.
            //    The DELETE+INSERT pattern makes the data write
            //    idempotent across retries; the AI-billing dedup above
            //    handles the orthogonal cost concern.
            await client.query('DELETE FROM appointment_pre_screenings WHERE appointment_id = $1', [appointment_id]);

            // 2. Hydrate per-question metadata + persist responses with
            //    weighted scores. The `weighted` accumulator path doubles
            //    as the deterministic-mode result AND the AI fallback.
            //
            //    The `is_active = true` filter rejects responses whose
            //    underlying question was deactivated by an admin between
            //    form-load and submit. Inactive questions are clinically
            //    out-of-scope, so they contribute zero to the score and
            //    are NOT persisted to `appointment_pre_screenings`.
            //    The patient submission as a whole succeeds — we never
            //    fail a clinical flow because of an admin's mid-form
            //    edit; the inactive responses simply drop from scoring.
            const aiQuestionInputs: TriageAiQuestionInput[] = [];
            const aiResponseInputs: TriageAiResponseInput[] = [];
            let totalRiskScore = 0;
            let maxPossibleRisk = 0;
            let inactiveCount = 0;

            for (const resp of responses) {
                // Fetch the weight + text for this specific question.
                // pg returns NUMERIC as string; Number() converts safely
                // (NaN if malformed → safe-default to 1).
                const qResult = await client.query<{
                    question_text: string;
                    disease_tag: string | null;
                    risk_weight: string | number | null;
                }>(
                    'SELECT question_text, disease_tag, risk_weight FROM pre_screening_definitions WHERE id = $1 AND is_active = true',
                    [resp.question_id]
                );
                const row = qResult.rows[0];
                if (row === undefined) {
                    // Question was deactivated or deleted between form
                    // hydration and submit. Skip silently — neither
                    // score nor persist. Counted for audit visibility.
                    inactiveCount += 1;
                    continue;
                }

                const rawWeight = row.risk_weight;
                const parsedWeight = rawWeight === null || rawWeight === undefined ? 1 : Number(rawWeight);
                const weight = Number.isFinite(parsedWeight) ? parsedWeight : 1;

                maxPossibleRisk += weight;
                if (resp.response_value) {
                    totalRiskScore += weight;
                }

                aiQuestionInputs.push({
                    id: resp.question_id,
                    text: row.question_text,
                    weight,
                    diseaseTag: row.disease_tag ?? undefined,
                });
                aiResponseInputs.push({
                    questionId: resp.question_id,
                    answer: resp.response_value,
                });

                await client.query(`
                    INSERT INTO appointment_pre_screenings (appointment_id, question_id, response_value, additional_notes, risk_score)
                    VALUES ($1, $2, $3, $4, $5)
                `, [appointment_id, resp.question_id, resp.response_value, resp.additional_notes || null, weight]);
            }

            // 3. Compute the normalised risk score per the resolved mode.
            //    AI mode either uses a recent-retry cache hit (no
            //    duplicate Gemini call) or makes a fresh call, with
            //    graceful fallback to the deterministic weighted
            //    normalisation if Gemini throws for any reason. The
            //    actual code path is recorded in audit metadata so
            //    degraded / dedup'd paths are observable.
            const deterministicRisk: number = maxPossibleRisk > 0 ? totalRiskScore / maxPossibleRisk : 0;
            let normalizedRisk: number = deterministicRisk;
            let resolvedMode: RiskCalculationMode = configuredMode;
            let aiDegradationReason: string | null = null;
            let aiCacheHit: boolean = false;

            if (configuredMode === 'ai') {
                if (cachedAiScore !== null) {
                    // Retry-dedup: the same patient resubmitted the
                    // SAME answers within the 60-second window. Reuse
                    // the prior AI result instead of paying for a
                    // duplicate Gemini call.
                    normalizedRisk = cachedAiScore;
                    aiCacheHit = true;
                } else {
                    try {
                        const aiResult = await scoreTriageWithAi(aiQuestionInputs, aiResponseInputs);
                        normalizedRisk = aiResult.normalisedRisk;
                        rememberAiScore(appointment_id, responseFingerprint, aiResult.normalisedRisk);
                    } catch (aiErr: unknown) {
                        // Graceful fallback. Patient flow MUST continue;
                        // the deterministic value is already computed.
                        resolvedMode = 'manual';
                        aiDegradationReason = aiErr instanceof TriageAiScorerError
                            ? aiErr.message
                            : aiErr instanceof Error ? aiErr.message : String(aiErr);
                        logger.warn('[PreScreening] AI scorer failed; falling back to deterministic', {
                            appointment_id,
                            reason: aiDegradationReason,
                        });
                    }
                }
            }

            const status = normalizedRisk >= highRiskThreshold ? 'high-risk' : 'completed';
            await client.query('UPDATE appointments SET pre_screening_status = $1 WHERE id = $2', [status, appointment_id]);

            await client.query('COMMIT');

            // Institutional Logging — captures every distinguishable
            // execution path so audit consumers can attribute outcomes:
            //   configured=manual + resolved=manual                   → normal manual
            //   configured=ai     + resolved=ai     + cacheHit=true   → AI retry-dedup'd
            //   configured=ai     + resolved=ai     + cacheHit=false  → normal AI
            //   configured=ai     + resolved=manual + reason          → AI DEGRADED
            await auditService.log({
                userId: userId || SYSTEM_ANONYMOUS_ID,
                action: aiDegradationReason !== null ? 'HEALTH_SCREENING_AI_DEGRADED' : 'HEALTH_SCREENING_SUBMITTED',
                entityId: String(appointment_id),
                entityType: 'APPOINTMENT',
                metadata: {
                    normalizedRisk,
                    deterministicRisk,
                    highRiskThreshold,
                    responseCount: responses.length,
                    inactiveResponsesSkipped: inactiveCount,
                    configuredMode,
                    resolvedMode,
                    aiCacheHit,
                    aiDegradationReason: aiDegradationReason ?? undefined,
                }
            });

            return { healthScore: normalizedRisk };

        } catch (error: unknown) {
            await client.query('ROLLBACK');
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Failed to save health screening responses', { error: errorMessage, appointment_id });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Admin Protocol: Batch update sorting order of screening questions.
     * Transactional integrity ensures all or nothing.
     */
    async reorderDefinitions(updates: { id: string; sort_order: number }[]): Promise<boolean> {
        const client: PoolClient = await this.db.connect();
        try {
            await client.query('BEGIN');
            
            for (const update of updates) {
                await client.query(
                    'UPDATE pre_screening_definitions SET sort_order = $1 WHERE id = $2',
                    [update.sort_order, update.id]
                );
            }
            
            await client.query('COMMIT');
            return true;
        } catch (error: unknown) {
            await client.query('ROLLBACK');
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Failed to reorder pre-screening definitions', { error: errorMessage });
            throw error;
        } finally {
            client.release();
        }
    }
}

export const preScreeningRepository = new PreScreeningRepository();
