import { Pool, PoolClient } from 'pg';
import { pool } from '../config/db';
import { logger } from '../utils/logger';
import { auditService, SYSTEM_ANONYMOUS_ID } from '../services/audit.service';

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

        const client: PoolClient = await this.db.connect();
        try {
            await client.query('BEGIN');

            // 1. Clear existing responses (if any) for this appointment
            await client.query('DELETE FROM appointment_pre_screenings WHERE appointment_id = $1', [appointment_id]);

            // 2. Batch insert new responses
            let totalRiskScore = 0;
            let maxPossibleRisk = 0;

            for (const resp of responses) {
                // Fetch the weight for this specific question to ensure logic integrity.
                // pg returns NUMERIC as string; Number() converts safely (NaN if malformed).
                const qResult = await client.query<{ risk_weight: string | number | null }>(
                    'SELECT risk_weight FROM pre_screening_definitions WHERE id = $1',
                    [resp.question_id]
                );
                const rawWeight = qResult.rows[0]?.risk_weight;
                const parsedWeight = rawWeight === null || rawWeight === undefined ? 1 : Number(rawWeight);
                const weight = Number.isFinite(parsedWeight) ? parsedWeight : 1;

                maxPossibleRisk += weight;
                if (resp.response_value) {
                    totalRiskScore += weight;
                }

                await client.query(`
                    INSERT INTO appointment_pre_screenings (appointment_id, question_id, response_value, additional_notes, risk_score)
                    VALUES ($1, $2, $3, $4, $5)
                `, [appointment_id, resp.question_id, resp.response_value, resp.additional_notes || null, weight]);
            }

            // 3. Update appointment status based on weighted score (Google-grade Triage)
            const normalizedRisk = maxPossibleRisk > 0 ? totalRiskScore / maxPossibleRisk : 0;
            const status = normalizedRisk >= 0.7 ? 'high-risk' : 'completed';

            await client.query('UPDATE appointments SET pre_screening_status = $1 WHERE id = $2', [status, appointment_id]);

            await client.query('COMMIT');

            // Institutional Logging
            await auditService.log({
                userId: userId || SYSTEM_ANONYMOUS_ID,
                action: 'HEALTH_SCREENING_SUBMITTED',
                entityId: String(appointment_id),
                entityType: 'APPOINTMENT',
                metadata: { normalizedRisk, responseCount: responses.length }
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
