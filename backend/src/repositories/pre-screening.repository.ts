import { Pool, PoolClient } from 'pg';
import { pool } from '../config/db';
import { logger } from '../utils/logger';
import { auditService, SYSTEM_ANONYMOUS_ID } from '../services/audit.service';
import { systemSettingsRepository } from './system-settings.repository';
import {
    scoreTriageWithAi,
    TriageAiScorerError,
    type TriageAiQuestionInput,
    type TriageAiResponseInput,
} from '../services/triage-ai-scorer.service';

/**
 * Storage key for the platform-wide risk-calculation-mode setting.
 * Held alongside other `system_settings` rows; default is `'manual'`
 * (existing behaviour) when no row exists yet.
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

        // Resolve the platform-wide risk-calculation mode BEFORE the
        // transaction opens. The mode is a simple key-value read; no
        // need to hold a write lock while we wait on it. Failure here
        // (DB hiccup) collapses to the institutional default — patient
        // flow continues with deterministic scoring.
        let configuredMode: RiskCalculationMode = DEFAULT_RISK_CALCULATION_MODE;
        try {
            const raw = await systemSettingsRepository.getSetting(RISK_CALCULATION_MODE_KEY);
            if (isRiskCalculationMode(raw)) {
                configuredMode = raw;
            }
        } catch (modeErr: unknown) {
            logger.warn('[PreScreening] Could not resolve risk-calculation mode; defaulting to manual', {
                error: modeErr instanceof Error ? modeErr.message : String(modeErr),
            });
        }

        const client: PoolClient = await this.db.connect();
        try {
            await client.query('BEGIN');

            // 1. Clear existing responses (if any) for this appointment
            await client.query('DELETE FROM appointment_pre_screenings WHERE appointment_id = $1', [appointment_id]);

            // 2. Hydrate per-question metadata + persist responses with
            //    weighted scores. The `weighted` accumulator path doubles
            //    as the deterministic-mode result AND the AI fallback.
            const aiQuestionInputs: TriageAiQuestionInput[] = [];
            const aiResponseInputs: TriageAiResponseInput[] = [];
            let totalRiskScore = 0;
            let maxPossibleRisk = 0;

            for (const resp of responses) {
                // Fetch the weight + text for this specific question.
                // pg returns NUMERIC as string; Number() converts safely
                // (NaN if malformed → safe-default to 1).
                const qResult = await client.query<{
                    question_text: string;
                    disease_tag: string | null;
                    risk_weight: string | number | null;
                }>(
                    'SELECT question_text, disease_tag, risk_weight FROM pre_screening_definitions WHERE id = $1',
                    [resp.question_id]
                );
                const row = qResult.rows[0];
                const rawWeight = row?.risk_weight;
                const parsedWeight = rawWeight === null || rawWeight === undefined ? 1 : Number(rawWeight);
                const weight = Number.isFinite(parsedWeight) ? parsedWeight : 1;

                maxPossibleRisk += weight;
                if (resp.response_value) {
                    totalRiskScore += weight;
                }

                if (row !== undefined) {
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
                }

                await client.query(`
                    INSERT INTO appointment_pre_screenings (appointment_id, question_id, response_value, additional_notes, risk_score)
                    VALUES ($1, $2, $3, $4, $5)
                `, [appointment_id, resp.question_id, resp.response_value, resp.additional_notes || null, weight]);
            }

            // 3. Compute the normalised risk score per the resolved mode.
            //    AI mode tries Gemini and gracefully degrades to the
            //    deterministic weighted normalisation if the AI scorer
            //    throws for any reason. The actual mode used is recorded
            //    in audit metadata so degraded paths are observable.
            const deterministicRisk: number = maxPossibleRisk > 0 ? totalRiskScore / maxPossibleRisk : 0;
            let normalizedRisk: number = deterministicRisk;
            let resolvedMode: RiskCalculationMode = configuredMode;
            let aiDegradationReason: string | null = null;

            if (configuredMode === 'ai') {
                try {
                    const aiResult = await scoreTriageWithAi(aiQuestionInputs, aiResponseInputs);
                    normalizedRisk = aiResult.normalisedRisk;
                } catch (aiErr: unknown) {
                    // Graceful fallback. Patient flow MUST continue; the
                    // deterministic value is already computed above.
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

            const status = normalizedRisk >= 0.7 ? 'high-risk' : 'completed';
            await client.query('UPDATE appointments SET pre_screening_status = $1 WHERE id = $2', [status, appointment_id]);

            await client.query('COMMIT');

            // Institutional Logging — capture configured mode, resolved
            // mode (different when AI degraded), AND degradation reason
            // so audit consumers can distinguish three states:
            //   configured=manual + resolved=manual         → normal manual
            //   configured=ai     + resolved=ai             → normal AI
            //   configured=ai     + resolved=manual + reason → AI DEGRADED
            await auditService.log({
                userId: userId || SYSTEM_ANONYMOUS_ID,
                action: aiDegradationReason !== null ? 'HEALTH_SCREENING_AI_DEGRADED' : 'HEALTH_SCREENING_SUBMITTED',
                entityId: String(appointment_id),
                entityType: 'APPOINTMENT',
                metadata: {
                    normalizedRisk,
                    deterministicRisk,
                    responseCount: responses.length,
                    configuredMode,
                    resolvedMode,
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
