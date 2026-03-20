import api from './api';

// =====================================================
// DOCTOR API SERVICE
// =====================================================

export interface DoctorProfile {
    id: string;
    name: string;
    email: string;
    phone_number: string;
    specialization: string;
    license_number?: string;
    years_of_experience: number;
    bio: string;
    consultation_fee: number;
    is_verified: boolean;
}

export interface DoctorSchedule {
    id: number; // Institutional Note: Database uses SERIAL for schedule entry IDs
    doctor_id: string; // Institutional Realignment: uuid
    day_of_week: number; // 0-6
    start_time: string;
    end_time: string;
    is_available: boolean;
}

export interface Patient {
    id: string; // Institutional Realignment: uuid (matches users.id)
    name: string;
    phone_number: string;
    email?: string;
    total_appointments: number;
    last_visit: string;
}

// List all verified doctors
export const listDoctors = async (params?: { specialization?: string; search?: string }) => {
    const response = await api.get<DoctorProfile[]>('/doctor', { params });
    return response.data;
};

// Get doctor profile by ID
export const getDoctorProfile = async (id: string) => {
    const response = await api.get<DoctorProfile>(`/doctor/${id}`);
    return response.data;
};

// Get list of specializations
export const getSpecializations = async () => {
    const response = await api.get<string[]>('/doctor/specializations');
    return response.data;
};

// Update doctor's own profile (Doctor only)
export const updateDoctorProfile = async (data: {
    specialization?: string;
    years_of_experience?: number;
    bio?: string;
    consultation_fee?: number;
}) => {
    const response = await api.put('/doctor/profile', data);
    return response.data;
};

// Get doctor's schedule
export const getDoctorSchedule = async () => {
    const response = await api.get<DoctorSchedule[]>('/doctor/me/schedule');
    return response.data;
};

// Update doctor's schedule
export const updateDoctorSchedule = async (schedule: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_available: boolean;
}>) => {
    const response = await api.put('/doctor/me/schedule', { schedule });
    return response.data;
};

// Get doctor's patients
export const getDoctorPatients = async () => {
    const response = await api.get<Patient[]>('/doctor/me/patients');
    return response.data;
};

// Alias for listDoctors (used by some components)
export const getDoctors = listDoctors;

export default {
    listDoctors,
    getDoctors,
    getDoctorProfile,
    getSpecializations,
    updateDoctorProfile,
    getDoctorSchedule,
    updateDoctorSchedule,
    getDoctorPatients
};
