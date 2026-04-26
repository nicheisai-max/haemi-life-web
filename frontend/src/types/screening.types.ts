/**
 * Clinical Screening System - Frontend Type Definitions
 * Institutional Grade | Strict TypeScript
 */

export type DiseaseCategory = 'TB' | 'MALARIA' | 'VIRAL';
export type ScreeningOutcome = 'PRESUMPTIVE' | 'NEGATIVE';
export type InputType = 'BOOLEAN' | 'SELECT' | 'TEXT';

export interface ScreeningQuestion {
    id: string;
    diseaseCategory: DiseaseCategory;
    questionTextEn: string;
    inputType: InputType;
    displayOrder: number;
}

export interface SubmitScreeningRequest {
    appointmentId?: number | string;
    responses: Record<string, boolean>; // { [questionId]: true/false }
}

export interface SubmitScreeningResponse {
    screeningId: string;
    outcome: ScreeningOutcome;
    message: string;
}
