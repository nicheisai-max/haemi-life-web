import api from './api';

// =====================================================
// PRESCRIPTION API SERVICE
// =====================================================

export interface PrescriptionItem {
    id: number; // Institutional Realignment: integer
    prescription_id: number; // Institutional Realignment: integer
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
    id: number; // Institutional Realignment: integer
    patient_id: string; // Institutional Realignment: uuid
    doctor_id: string; // Institutional Realignment: uuid
    appointment_id?: number; // Institutional Realignment: integer
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

export const createPrescription = async (data: {
    patient_id: string;
    appointment_id?: string;
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
export const getPrescriptionById = async (id: string | number) => {
    const response = await api.get(`/prescriptions/${id}`);
    return response.data as Prescription;
};

// Update prescription status (Pharmacist)
export const updatePrescriptionStatus = async (id: string | number, status: string) => {
    const response = await api.put(`/prescriptions/${id}/status`, { status });
    return response.data;
};

// Get pending prescriptions (Pharmacist)
export const getPendingPrescriptions = async () => {
    const response = await api.get('/prescriptions/pending/list');
    return response.data as Prescription[];
};

// Get ALL prescriptions — uses dedicated route, returns all statuses for pharmacist
export const getAllPrescriptions = async () => {
    const response = await api.get('/prescriptions/pending/list');
    return response.data as Prescription[];
};

export default {
    createPrescription,
    getMyPrescriptions,
    getPrescriptionById,
    updatePrescriptionStatus,
    getPendingPrescriptions
};
