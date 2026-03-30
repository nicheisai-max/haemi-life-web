import api, { normalizeResponse } from './api';
import type { ApiResponse } from '../types/auth.types';

// =====================================================
// PRESCRIPTION API SERVICE
// =====================================================

export interface PrescriptionItem {
    id: number;
    prescriptionId: number;
    medicineId: number;
    medicineName?: string;
    category?: string;
    strength?: string;
    dosage: string;
    frequency: string;
    durationDays: number | null;
    quantity: number | null;
    instructions: string | null;
}

export interface Prescription {
    id: number;
    patientId: string;
    doctorId: string;
    appointmentId: number | null;
    prescriptionDate: string;
    status: 'pending' | 'filled' | 'cancelled';
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    // Populated fields
    patientName?: string;
    doctorName?: string;
    medicationCount?: number;
    items?: PrescriptionItem[];
}

export const createPrescription = async (data: {
    patientId: string;
    appointmentId?: string;
    notes?: string;
    medications: Array<{
        medicineId: number;
        dosage: string;
        frequency: string;
        durationDays?: number;
        quantity?: number;
        instructions?: string;
    }>;
}) => {
    const response = await api.post<ApiResponse<Prescription>>('/prescriptions', data);
    return normalizeResponse(response);
};

// Get user's prescriptions (Patient/Doctor)
export const getMyPrescriptions = async () => {
    const response = await api.get<ApiResponse<Prescription[]>>('/prescriptions/my-prescriptions');
    return normalizeResponse(response);
};

// Get prescription by ID with items
export const getPrescriptionById = async (id: number) => {
    const response = await api.get<ApiResponse<Prescription>>(`/prescriptions/${id}`);
    return normalizeResponse(response);
};

// Update prescription status (Pharmacist)
export const updatePrescriptionStatus = async (id: number, status: string) => {
    const response = await api.put<ApiResponse<Prescription>>(`/prescriptions/${id}/status`, { status });
    return normalizeResponse(response);
};

// Get pending prescriptions (Pharmacist)
export const getPendingPrescriptions = async () => {
    const response = await api.get<ApiResponse<Prescription[]>>('/prescriptions/pending/list');
    return normalizeResponse(response);
};

// Get ALL prescriptions — uses dedicated route, returns all statuses for pharmacist
export const getAllPrescriptions = async () => {
    const response = await api.get<ApiResponse<Prescription[]>>('/prescriptions/pending/list');
    return normalizeResponse(response);
};

export default {
    createPrescription,
    getMyPrescriptions,
    getPrescriptionById,
    updatePrescriptionStatus,
    getPendingPrescriptions
};
