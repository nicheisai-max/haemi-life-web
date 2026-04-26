/**
 * Clinical Screening System - Type Definitions
 * Institutional Grade | Zero 'any' Policy | Strict TypeScript
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

export type DiseaseCategory = 'TB' | 'MALARIA' | 'VIRAL';
export type ScreeningOutcome = 'PRESUMPTIVE' | 'NEGATIVE';
export type InputType = 'BOOLEAN' | 'SELECT' | 'TEXT';

// ─── Database Row Types ───────────────────────────────────────────────────────

export interface ScreeningQuestionRow {
    id: string;
    disease_category: DiseaseCategory;
    question_text_en: string;
    input_type: InputType;
    display_order: number;
    is_active: boolean;
    created_at: string;
}

export interface PatientScreeningRecordRow {
    id: string;
    patient_id: string;
    appointment_id: string | null;
    overall_outcome: ScreeningOutcome;
    responses: Record<string, boolean>;
    created_at: string;
}

// ─── API Request / Response Types ─────────────────────────────────────────────

export interface SubmitScreeningRequest {
    appointmentId?: number | string;
    responses: Record<string, boolean>; // { [questionId]: true/false }
}

export interface ScreeningQuestionResponse {
    id: string;
    diseaseCategory: DiseaseCategory;
    questionTextEn: string;
    inputType: InputType;
    displayOrder: number;
}

export interface SubmitScreeningResponse {
    screeningId: string;
    outcome: ScreeningOutcome;
    message: string;
}
