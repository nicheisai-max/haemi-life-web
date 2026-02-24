import api from './api';

// =====================================================
// APPOINTMENT API SERVICE
// =====================================================

export interface Appointment {
    id: number;
    patient_id: string;
    doctor_id: string;
    appointment_date: string;
    appointment_time: string;
    duration_minutes: number;
    status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
    reason: string;
    notes?: string;
    created_at: string;
    updated_at: string;
    // Populated fields
    doctor_name?: string;
    patient_name?: string;
    patient_phone?: string;
    specialization?: string;
    other_party_name?: string;
    user_role?: 'patient' | 'doctor';
}

export interface AvailableSlots {
    date: string;
    slots: string[];
}

// Book a new appointment (Patient only)
export const bookAppointment = async (data: {
    doctor_id: string;
    appointment_date: string;
    appointment_time: string;
    consultation_type: string;
    reason: string;
}) => {
    const response = await api.post('/appointments', data);
    return response.data;
};

// Get user's appointments
export const getMyAppointments = async (params?: { status?: string; upcoming?: boolean }) => {
    const response = await api.get('/appointments/my-appointments', { params });
    return response.data as Appointment[];
};

// Get appointment by ID
export const getAppointmentById = async (id: number) => {
    const response = await api.get(`/appointments/${id}`);
    return response.data as Appointment;
};

// Update appointment status (Doctor only)
export const updateAppointmentStatus = async (id: number, status: string, notes?: string) => {
    const response = await api.put(`/appointments/${id}/status`, { status, notes });
    return response.data;
};

// Cancel appointment (soft-cancel — sets status to 'cancelled')
export const cancelAppointment = async (id: number) => {
    const response = await api.delete(`/appointments/${id}`);
    return response.data;
};

// Permanently delete a past/completed/cancelled appointment (Patient only)
export const deleteAppointment = async (id: number) => {
    const response = await api.delete(`/appointments/${id}/permanent`);
    return response.data;
};

// Get available time slots
export const getAvailableSlots = async (doctor_id: string, date: string) => {
    const response = await api.get('/appointments/available-slots', {
        params: { doctor_id, date }
    });
    return response.data as AvailableSlots;
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

