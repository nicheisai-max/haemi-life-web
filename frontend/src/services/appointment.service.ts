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

// Book a new appointment (Patient only)
export const bookAppointment = async (data: {
    doctorId: string;
    appointmentDate: string;
    appointmentTime: string;
    consultationType: string;
    reason: string;
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

// Get available time slots
export const getAvailableSlots = async (doctorId: string, date: string): Promise<AvailableSlots> => {
    const response = await api.get<ApiResponse<AvailableSlots>>('/appointments/available-slots', {
        params: { doctor_id: doctorId, date }
    });
    return normalizeResponse(response);
};

export default {
    bookAppointment,
    getMyAppointments,
    getAppointmentById,
    updateAppointmentStatus,
    cancelAppointment,
    deleteAppointment,
    getAvailableSlots
};

