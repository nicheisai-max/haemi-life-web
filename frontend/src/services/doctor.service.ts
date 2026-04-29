import api, { normalizeResponse } from './api';
import type { ApiResponse } from '../types/auth.types';

// =====================================================
// DOCTOR API SERVICE
// =====================================================

export interface DoctorProfile {
    id: string;
    name: string;
    email: string;
    phoneNumber: string;
    specialization: string;
    licenseNumber?: string;
    yearsOfExperience: number;
    bio: string;
    consultationFee: number;
    isVerified: boolean;
    profileImage?: string | null;
    canVideoConsult: boolean;
}

export interface DoctorSchedule {
    id: number; // Institutional Note: Database uses SERIAL for schedule entry IDs
    doctorId: string; // Institutional Realignment: uuid
    dayOfWeek: number; // 0-6
    startTime: string;
    endTime: string;
    isAvailable: boolean;
}

export interface Patient {
    id: string; // Institutional Realignment: uuid (matches users.id)
    name: string;
    phoneNumber: string;
    email?: string;
    totalAppointments: number;
    lastVisit: string;
    profileImage?: string | null;
}

// List all verified doctors
export const listDoctors = async (params?: { specialization?: string; search?: string }) => {
    const response = await api.get<ApiResponse<DoctorProfile[]>>('/doctor', { params });
    return normalizeResponse(response);
};

// Get doctor profile by ID
export const getDoctorProfile = async (id: string) => {
    const response = await api.get<ApiResponse<DoctorProfile>>(`/doctor/${id}`);
    return normalizeResponse(response);
};

// Get list of specializations
export const getSpecializations = async () => {
    const response = await api.get<ApiResponse<string[]>>('/doctor/specializations');
    return normalizeResponse(response);
};

// Update doctor's own profile (Doctor only)
export const updateDoctorProfile = async (data: {
    specialization?: string;
    yearsOfExperience?: number;
    bio?: string;
    consultationFee?: number;
}): Promise<DoctorProfile> => {
    const response = await api.put<ApiResponse<DoctorProfile>>('/doctor/profile', data);
    return normalizeResponse(response);
};

// Get doctor's schedule
export const getDoctorSchedule = async () => {
    const response = await api.get<ApiResponse<DoctorSchedule[]>>('/doctor/me/schedule');
    return normalizeResponse(response);
};

// Update doctor's schedule
export const updateDoctorSchedule = async (schedule: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
}>): Promise<DoctorSchedule[]> => {
    const response = await api.put<ApiResponse<DoctorSchedule[]>>('/doctor/me/schedule', { schedule });
    return normalizeResponse(response);
};

// Get doctor's patients
export const getDoctorPatients = async () => {
    const response = await api.get<ApiResponse<Patient[]>>('/doctor/me/patients');
    return normalizeResponse(response);
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
