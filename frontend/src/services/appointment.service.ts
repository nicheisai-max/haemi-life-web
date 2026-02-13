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
    // Legacy/Old definition (commented out in case backend actually returns this)
    // schedule: Array<{
    //     start_time: string;
    //     end_time: string;
    // }>;
    // booked: string[];
}

// Book a new appointment (Patient only)
export const bookAppointment = async (data: {
    doctor_id: string;
    appointment_date: string;
    appointment_time: string;
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

// Cancel appointment
export const cancelAppointment = async (id: number) => {
    const response = await api.delete(`/appointments/${id}`);
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
    getAvailableSlots
};
