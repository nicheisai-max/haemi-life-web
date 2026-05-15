import api, { normalizeResponse } from './api';
import type { ApiResponse } from '../types/auth.types';
import { auditLogger } from '../utils/logger';

/**
 * 🛡️ HAEMI LIFE: HEALTH SCREENING SERVICE (Unified)
 * Institutional Grade: Strictly typed service for all triage and clinical screening operations.
 * Standards: Google/Meta-grade TypeScript | Zero 'any' Policy | Strict Audit Logging.
 */

// ─── ADMIN: Dynamic Triage Definition Types ───────────────────────────────────

export interface ScreeningQuestion {
    id: string;
    category: 'triage';
    question_text: string;
    disease_tag?: string;
    risk_weight: number;
    is_active: boolean;
    sort_order: number;
}

export interface ScreeningResponse {
    question_id: string;
    response_value: boolean;
}

export interface RiskReport {
    score: number;
    level: 'Low' | 'Medium' | 'High';
    message: string;
}

// ─── PATIENT: Clinical Submission Types ──────────────────────────────────────

export interface StructuredScreeningQuestion {
    id: string;
    diseaseCategory: string;
    questionTextEn: string;
    inputType: string;
    displayOrder: number;
}

export interface SubmitScreeningRequest {
    appointmentId?: string;
    responses: Record<string, boolean>;
}

export interface SubmitScreeningResponse {
    screeningId: string;
    outcome: 'PRESUMPTIVE' | 'NEGATIVE';
    message: string;
}

// ─── ADMIN: Triage Definition Management API ─────────────────────────────────

// Fetch all active questions for patients
export const getActiveQuestions = async (): Promise<ScreeningQuestion[]> => {
    const response = await api.get<ApiResponse<ScreeningQuestion[]>>('/screening/definitions');
    return normalizeResponse(response);
};

// Admin: Fetch all questions (including inactive)
export const getAllQuestions = async (): Promise<ScreeningQuestion[]> => {
    const response = await api.get<ApiResponse<ScreeningQuestion[]>>('/screening/definitions/all');
    return normalizeResponse(response);
};

// Admin: Create new question
export const createQuestion = async (data: Omit<ScreeningQuestion, 'id'>): Promise<ScreeningQuestion> => {
    const response = await api.post<ApiResponse<ScreeningQuestion>>('/screening/definitions', data);
    return normalizeResponse(response);
};

// Admin: Update question
export const updateQuestion = async (id: string, data: Partial<ScreeningQuestion>): Promise<ScreeningQuestion> => {
    const response = await api.put<ApiResponse<ScreeningQuestion>>(`/screening/definitions/${id}`, data);
    return normalizeResponse(response);
};

// Admin: Toggle active status
export const toggleQuestion = async (id: string, is_active: boolean): Promise<ScreeningQuestion> => {
    const response = await api.patch<ApiResponse<ScreeningQuestion>>(`/screening/definitions/${id}/toggle`, { is_active });
    return normalizeResponse(response);
};

// Admin: Delete question
export const deleteQuestion = async (id: string): Promise<void> => {
    await api.delete(`/screening/definitions/${id}`);
};

// Admin: Reorder questions
export const reorderQuestions = async (updates: { id: string; sort_order: number }[]): Promise<void> => {
    const response = await api.patch<ApiResponse<void>>('/screening/definitions/reorder', { updates });
    return normalizeResponse(response);
};

// ─── ADMIN: Risk Calculation Mode (AI vs deterministic weights) ──────────────

/**
 * Platform-wide risk calculation mode. `'ai'` routes patient triage
 * scoring through Gemini (server-side + client preview); `'manual'`
 * uses the admin-configured `risk_weight` per question. The AI failure
 * path always falls back to manual gracefully — patient flow is never
 * halted by an unavailable Gemini API.
 */
export type RiskCalculationMode = 'ai' | 'manual';

export interface RiskCalculationModeResponse {
    mode: RiskCalculationMode;
}

/** Read-only fetch — used by both admin (current value display) and
 *  patient client (decide whether to attempt the AI preview call). */
export const getRiskCalculationMode = async (): Promise<RiskCalculationMode> => {
    const response = await api.get<ApiResponse<RiskCalculationModeResponse>>('/screening/risk-mode');
    const data = normalizeResponse(response);
    return data.mode;
};

/** Admin-only update. Server validates the mode value strictly; on
 *  success returns the persisted mode (echoed for UI consistency). */
export const updateRiskCalculationMode = async (mode: RiskCalculationMode): Promise<RiskCalculationMode> => {
    const response = await api.put<ApiResponse<RiskCalculationModeResponse>>(
        '/admin/settings/risk-calculation-mode',
        { mode }
    );
    const data = normalizeResponse(response);
    return data.mode;
};

// ─── ADMIN: Pre-screening High-Risk Threshold (Enterprise Hardening) ─────────

/**
 * Platform-wide threshold (0-1) for classifying a pre-screening
 * submission as `'high-risk'`. Lifted from a previously-hardcoded
 * `0.7` into `system_settings.pre_screening_high_risk_threshold`.
 * Admin-only; the patient UI never surfaces this value.
 */
export interface HighRiskThresholdResponse {
    threshold: number;
}

export const getHighRiskThreshold = async (): Promise<number> => {
    const response = await api.get<ApiResponse<HighRiskThresholdResponse>>(
        '/admin/settings/high-risk-threshold'
    );
    return normalizeResponse(response).threshold;
};

export const updateHighRiskThreshold = async (threshold: number): Promise<number> => {
    const response = await api.put<ApiResponse<HighRiskThresholdResponse>>(
        '/admin/settings/high-risk-threshold',
        { threshold }
    );
    return normalizeResponse(response).threshold;
};

/**
 * 🩺 INSTITUTIONAL AI-TRIAGE ENGINE (v15.0 Platinum)
 * Logic: Hybrid Intelligence — Combines Quantitative Risk Weighting with Qualitative AI Analysis.
 * Standard: Deterministic Fallback Guard | Zero Data-Drift Prompting | Strict Type Narrowing.
 *
 * Mode gating (admin-controlled, runtime-resolved):
 *   The platform-wide `risk_calculation_mode` setting is fetched from
 *   `GET /screening/risk-mode` at the start of this call. When the
 *   admin has flipped the mode to `'manual'`, the AI round-trip is
 *   skipped entirely — saves the API cost and keeps the patient
 *   experience deterministic. When `'ai'`, the existing prompt + AI
 *   call + fallback chain runs as before. Mode-fetch failure itself
 *   collapses to deterministic (defensive) — patient flow is never
 *   blocked by a settings-read hiccup.
 */
export const analyzeWithAI = async (responses: ScreeningResponse[], questions: ScreeningQuestion[]): Promise<RiskReport> => {
    // 1. QUANTITATIVE CALCULATION: Summing clinical weights for deterministic fallback
    const totalScore = responses.reduce((acc, r) => {
        const q = questions.find(question => question.id === r.question_id);
        return r.response_value ? acc + (q?.risk_weight ?? 0) : acc;
    }, 0);

    // 2. DETERMINISTIC MAPPING (Safety Shield)
    const getDeterministicRisk = (score: number): RiskReport => {
        if (score >= 7) return { score, level: 'High', message: 'High risk detected via deterministic weighting. Urgent consultation recommended.' };
        if (score >= 4) return { score, level: 'Medium', message: 'Moderate risk identified. Clinical monitoring advised.' };
        return { score, level: 'Low', message: 'No immediate clinical danger detected via primary triage signals.' };
    };

    // 3. ADMIN-CONTROLLED MODE GATE: skip the AI round-trip entirely
    //    when the platform is configured for deterministic-only scoring.
    //    A settings-read failure also collapses to deterministic so the
    //    patient never pays for a network hiccup at the boundary.
    let resolvedMode: RiskCalculationMode = 'manual';
    try {
        resolvedMode = await getRiskCalculationMode();
    } catch (err: unknown) {
        auditLogger.log('AI_TRIAGE_MODE_FETCH_FAILED', {
            reason: err instanceof Error ? err.message : 'UNKNOWN',
        });
    }

    if (resolvedMode === 'manual') {
        return getDeterministicRisk(totalScore);
    }

    try {
        const clinicalSignals = responses.map(r => {
            const q = questions.find(question => question.id === r.question_id);
            return `${q?.question_text || 'Unknown'}: ${r.response_value ? 'YES' : 'NO'} (Importance: ${q?.risk_weight ?? 0})`;
        }).join('\n');

        const prompt = `
            ROLE: Clinical Triage AI (Haemi Life, South Africa)
            TASK: Analyze clinical signals and map risk based on symptoms and assigned weights.
            
            SIGNALS:
            ${clinicalSignals}
            
            AGGREGATE SCORE: ${totalScore}
            
            REQUIREMENTS:
            1. Risk Level must be Low, Medium, or High.
            2. Prioritize signals with weights >= 7 (Critical Indicators).
            3. Consider TB, HIV, and Respiratory infections as priority vectors.
            4. Output ONLY valid JSON:
               { "score": ${totalScore}, "level": "Low" | "Medium" | "High", "message": "Clinical insight string" }
        `;

        const response = await api.post<{ success: boolean; reply: string }>('/ai/ask', { prompt });

        if (response.data?.success && response.data?.reply) {
            const cleanedReply = response.data.reply.replace(/```json|```/g, '').trim();
            const report = JSON.parse(cleanedReply) as RiskReport;
            
            auditLogger.log('AI_TRIAGE_SUCCESS', { 
                details: { score: report.score, level: report.level } 
            });
            
            return report;
        }

        throw new Error('MALFORMED_AI_PAYLOAD');
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'AI_SYNC_DRIFT';
        
        auditLogger.log('AI_TRIAGE_FALLBACK', { 
            reason: errorMessage,
            details: { score: totalScore } 
        });

        // 3. INSTITUTIONAL RESILIENCE: Returning deterministic logic on AI failure
        const fallbackReport = getDeterministicRisk(totalScore);
        return {
            ...fallbackReport,
            message: `${fallbackReport.message} (Note: AI synchronization drifted; triage finalized via safety-fallback logic.)`
        };
    }
};

// ─── PATIENT: Structured Clinical Submission API ──────────────────────────────

/**
 * screeningService object — patient-facing structured submission flow.
 */
export const screeningService = {
    /**
     * Fetch all active screening questions from the backend (display_order sorted)
     */
    getQuestions: async (): Promise<StructuredScreeningQuestion[]> => {
        const response = await api.get<ApiResponse<StructuredScreeningQuestion[]>>('/screening/questions');
        return normalizeResponse(response);
    },

    /**
     * Submit patient screening responses and get clinical outcome
     */
    submitScreening: async (data: SubmitScreeningRequest): Promise<SubmitScreeningResponse> => {
        const response = await api.post<ApiResponse<SubmitScreeningResponse>>('/screening/submit', data);
        return normalizeResponse(response);
    }
};

export default {
    getActiveQuestions,
    getAllQuestions,
    createQuestion,
    updateQuestion,
    toggleQuestion,
    deleteQuestion,
    reorderQuestions,
    analyzeWithAI,
    getRiskCalculationMode,
    updateRiskCalculationMode,
    getHighRiskThreshold,
    updateHighRiskThreshold,
    screeningService
};
