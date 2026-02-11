import api from './api';

// =====================================================
// DOCTOR API SERVICE
// =====================================================

export interface DoctorProfile {
    id: number;
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
    id: number;
    doctor_id: number;
    day_of_week: number; // 0-6
    start_time: string;
    end_time: string;
    is_available: boolean;
}

export interface Patient {
    id: number;
    name: string;
    phone_number: string;
    email?: string;
    total_appointments: number;
    last_visit: string;
}

// List all verified doctors
export const listDoctors = async (params?: { specialization?: string; search?: string }) => {
    const response = await api.get('/doctors', { params });
    return response.data as DoctorProfile[];
};

// Get doctor profile by ID
export const getDoctorProfile = async (id: number) => {
    const response = await api.get(`/doctors/${id}`);
    return response.data as DoctorProfile;
};

// Get list of specializations
export const getSpecializations = async () => {
    const response = await api.get('/doctors/specializations');
    return response.data as string[];
};

// Update doctor's own profile (Doctor only)
export const updateDoctorProfile = async (data: {
    specialization?: string;
    years_of_experience?: number;
    bio?: string;
    consultation_fee?: number;
}) => {
    const response = await api.put('/doctors/profile', data);
    return response.data;
};

// Get doctor's schedule
export const getDoctorSchedule = async () => {
    const response = await api.get('/doctors/me/schedule');
    return response.data as DoctorSchedule[];
};

// Update doctor's schedule
export const updateDoctorSchedule = async (schedule: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_available: boolean;
}>) => {
    const response = await api.put('/doctors/me/schedule', { schedule });
    return response.data;
};

// Get doctor's patients
export const getDoctorPatients = async () => {
    const response = await api.get('/doctors/me/patients');
    return response.data as Patient[];
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
