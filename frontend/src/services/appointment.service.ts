import api, { normalizeResponse } from './api';
import type { ApiResponse } from '../types/auth.types';

// =====================================================
// APPOINTMENT API SERVICE
// =====================================================

export interface Appointment {
    id: number;
    patientId: string;
    doctorId: string;
    appointmentDate: string;
    appointmentTime: string;
    durationMinutes: number;
    status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
    consultationType: string;
    reason: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    // Populated fields
    doctorName?: string;
    patientName?: string;
    patientPhone?: string;
    specialization?: string;
    otherPartyName?: string;
    userRole?: 'patient' | 'doctor';
    profileImage?: string | null;
}

export interface AvailableSlots {
    date: string;
    slots: string[];
}

export interface PreScreeningQuestion {
    id: string;
    category: 'self-declaration' | 'triage' | 'risk-assessment';
    question_text: string;
    disease_tag?: string;
    risk_weight?: number;
    sort_order: number;
}

export interface PreScreeningResponse {
    question_id: string;
    response_value: boolean;
    additional_notes?: string;
}

// Book a new appointment (Patient only)
export const bookAppointment = async (data: {
    doctorId: string;
    appointmentDate: string;
    appointmentTime: string;
    consultationType: string;
    reason: string;
    // Legacy: inline pre-screening responses submitted with booking
    screeningResponses?: Array<{ question_id: string; response_value: boolean }>;
    riskScore?: number;
    riskLevel?: string;
    // New: link to a pre-existing clinical screening record
    screeningRecordId?: string;
}): Promise<Appointment> => {
    const response = await api.post<ApiResponse<Appointment>>('/appointments', data);
    return normalizeResponse(response);
};

// Get user's appointments
export const getMyAppointments = async (params?: { status?: string; upcoming?: boolean }): Promise<Appointment[]> => {
    const response = await api.get<ApiResponse<Appointment[]>>('/appointments/my-appointments', { params });
    return normalizeResponse(response);
};

// Get appointment by ID
export const getAppointmentById = async (id: number): Promise<Appointment> => {
    const response = await api.get<ApiResponse<Appointment>>(`/appointments/${id}`);
    return normalizeResponse(response);
};

// Update appointment status (Doctor only)
export const updateAppointmentStatus = async (id: number, status: string, notes?: string): Promise<Appointment> => {
    const response = await api.put<ApiResponse<Appointment>>(`/appointments/${id}/status`, { status, notes });
    return normalizeResponse(response);
};

// Cancel appointment (soft-cancel — sets status to 'cancelled')
export const cancelAppointment = async (id: number) => {
    const response = await api.delete<ApiResponse<Appointment>>(`/appointments/${id}`);
    return normalizeResponse(response);
};

// Permanently delete a past/completed/cancelled appointment (Patient only)
export const deleteAppointment = async (id: number) => {
    const response = await api.delete<ApiResponse<void>>(`/appointments/${id}/permanent`);
    return normalizeResponse(response);
};

// Doctor-side soft-archive — hides the row from THIS doctor's My Appointments
// list while preserving the appointment for the patient and the audit trail.
// Backend restricts this to terminal states (completed / cancelled / no-show);
// scheduled appointments cannot be archived. The row is preserved (no
// `deleted_at`), only `doctor_archived` flips to true.
export const archiveAppointmentForDoctor = async (id: number): Promise<void> => {
    const response = await api.post<ApiResponse<void>>(`/appointments/${id}/archive`);
    return normalizeResponse(response);
};

// Get available time slots
export const getAvailableSlots = async (doctorId: string, date: string): Promise<AvailableSlots> => {
    const response = await api.get<ApiResponse<AvailableSlots>>('/appointments/available-slots', {
        params: { doctorId: doctorId, date }
    });
    return normalizeResponse(response);
};

export const getPreScreeningQuestions = async (category?: string): Promise<PreScreeningQuestion[]> => {
    const params = category ? { category } : {};
    const response = await api.get<ApiResponse<PreScreeningQuestion[]>>('/appointments/pre-screening/questions', { params });
    return normalizeResponse(response);
};

export const submitPreScreening = async (appointmentId: string, responses: PreScreeningResponse[]): Promise<void> => {
    const response = await api.post<ApiResponse<void>>('/appointments/pre-screening/submit', { appointmentId, responses });
    return normalizeResponse(response);
};

export default {
    bookAppointment,
    getMyAppointments,
    getAppointmentById,
    updateAppointmentStatus,
    cancelAppointment,
    deleteAppointment,
    archiveAppointmentForDoctor,
    getAvailableSlots,
    getPreScreeningQuestions,
    submitPreScreening
};

