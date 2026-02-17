import api from './api';

// =====================================================
// PRESCRIPTION API SERVICE
// =====================================================

export interface PrescriptionItem {
    id: number;
    prescription_id: number;
    medicine_id: string;
    medicine_name?: string;
    category?: string;
    strength?: string;
    dosage: string;
    frequency: string;
    duration_days?: number;
    quantity?: number;
    instructions?: string;
}

export interface Prescription {
    id: number;
    patient_id: number;
    doctor_id: number;
    appointment_id?: number;
    prescription_date: string;
    status: 'pending' | 'filled' | 'cancelled';
    notes?: string;
    created_at: string;
    updated_at: string;
    // Populated fields
    patient_name?: string;
    doctor_name?: string;
    patient_phone?: string;
    specialization?: string;
    medication_count?: number;
    items?: PrescriptionItem[];
}

// Create a new prescription (Doctor only)
export const createPrescription = async (data: {
    patient_id: number;
    appointment_id?: number;
    notes?: string;
    medications: Array<{
        medicine_id: string;
        dosage: string;
        frequency: string;
        duration_days?: number;
        quantity?: number;
        instructions?: string;
    }>;
}) => {
    const response = await api.post('/prescriptions', data);
    return response.data;
};

// Get user's prescriptions (Patient/Doctor)
export const getMyPrescriptions = async () => {
    const response = await api.get('/prescriptions/my-prescriptions');
    return response.data as Prescription[];
};

// Get prescription by ID with items
export const getPrescriptionById = async (id: number) => {
    const response = await api.get(`/prescriptions/${id}`);
    return response.data as Prescription;
};

// Update prescription status (Pharmacist)
export const updatePrescriptionStatus = async (id: number, status: string) => {
    const response = await api.put(`/prescriptions/${id}/status`, { status });
    return response.data;
};

// Get pending prescriptions (Pharmacist)
export const getPendingPrescriptions = async () => {
    const response = await api.get('/prescriptions/pending/list');
    return response.data as Prescription[];
};

// Get ALL prescriptions (Pharmacist/Admin)
export const getAllPrescriptions = async () => {
    const response = await api.get('/prescriptions');
    return response.data as Prescription[];
};

export default {
    createPrescription,
    getMyPrescriptions,
    getPrescriptionById,
    updatePrescriptionStatus,
    getPendingPrescriptions
};
