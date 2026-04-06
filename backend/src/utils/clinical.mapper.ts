/**
 * 🩺 HAEMI LIFE — Clinical Data Mapper
 * Enforces camelCase institutional standard for API responses.
 * P0 FIX: Institutional URL Resolution (Zero-Ghost Standard)
 */

import { AppointmentWithDetails } from '../repositories/appointment.repository';
import { PrescriptionRow, PrescriptionItemRow } from '../repositories/prescription.repository';
import { MedicalRecordRow } from '../repositories/record-repository';

/**
 * HAEMI LIFE — Institutional Size Normalizer (Zero-Loss)
 */
const parseSizeToBytes = (input: unknown): number => {
    if (typeof input === 'number') return input;
    if (typeof input === 'string') {
        const cleaned = input.replace(/,/g, '').trim();
        const num = parseFloat(cleaned);
        if (isNaN(num)) return 0;
        
        const lower = cleaned.toLowerCase();
        if (lower.endsWith('gb')) return Math.round(num * 1024 * 1024 * 1024);
        if (lower.endsWith('mb')) return Math.round(num * 1024 * 1024);
        if (lower.endsWith('kb')) return Math.round(num * 1024);
        return Math.round(num);
    }
    return 0;
};

/**
 * Institutional File Size Formatter (API Response Standard)
 */
const formatBytes = (bytes: number): string => {
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// 1. APPOINTMENTS
export interface AppointmentResponse {
    id: number;
    patientId: string;
    doctorId: string;
    appointmentDate: string;
    appointmentTime: string;
    durationMinutes: number;
    status: string;
    consultationType: string;
    reason: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    doctorName?: string;
    patientName?: string;
    patientPhone?: string;
    specialization?: string;
    otherPartyName?: string;
    userRole?: string;
    profileImage?: string | null;
}

export const mapAppointmentToResponse = (data: AppointmentWithDetails): AppointmentResponse => {
    return {
        id: data.id,
        patientId: data.patient_id,
        doctorId: data.doctor_id,
        appointmentDate: data.appointment_date,
        appointmentTime: data.appointment_time,
        durationMinutes: data.duration_minutes,
        status: data.status,
        consultationType: data.consultation_type,
        reason: data.reason || null,
        notes: data.notes || null,
        createdAt: data.created_at.toISOString(),
        updatedAt: data.updated_at.toISOString(),
        doctorName: data.doctor_name,
        patientName: data.patient_name,
        patientPhone: data.patient_phone,
        specialization: data.specialization,
        otherPartyName: data.other_party_name,
        userRole: data.user_role,
        profileImage: data.profile_image || null
    };
};

// 2. PRESCRIPTIONS
export interface PrescriptionResponse {
    id: number;
    patientId: string;
    doctorId: string;
    appointmentId: number | null;
    notes: string | null;
    prescriptionDate: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    patientName?: string;
    doctorName?: string;
    medicationCount?: number;
}

export const mapPrescriptionToResponse = (data: PrescriptionRow): PrescriptionResponse => {
    return {
        id: data.id,
        patientId: data.patient_id,
        doctorId: data.doctor_id,
        appointmentId: data.appointment_id || null,
        notes: data.notes || null,
        prescriptionDate: data.prescription_date instanceof Date ? data.prescription_date.toISOString() : String(data.prescription_date),
        status: data.status,
        createdAt: data.created_at.toISOString(),
        updatedAt: data.updated_at.toISOString(),
        patientName: data.patient_name,
        doctorName: data.doctor_name,
        medicationCount: data.medication_count ? Number(data.medication_count) : 0
    };
};

// 3. MEDICAL RECORDS
export interface MedicalRecordResponse {
    id: string;
    patientId: string;
    name: string;
    url: string;
    fileMime?: string;
    fileSize?: string;
    recordType?: string;
    status?: string;
    notes?: string;
    uploadedAt: string;
    doctorName?: string;
    facilityName?: string;
    dateOfService?: string;
    sourceTable: string;
}

export const mapRecordToResponse = (data: MedicalRecordRow): MedicalRecordResponse => {
    const raw: unknown = data;
    const obj = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};

    const fileMime = typeof obj.file_mime === 'string'
        ? obj.file_mime
        : typeof obj.file_type === 'string'
        ? obj.file_type
        : 'application/octet-stream';

    const bytes = parseSizeToBytes(obj.file_size);
    const normalizedSize = bytes > 0 ? formatBytes(bytes) : '—';

    // Institutional URL Construction: Dedicated Clinical Gateway
    const clinicalUrl = `/api/records/file/${data.id}`;

    return {
        id: String(data.id),
        patientId: String(data.patient_id),
        name: data.name,
        url: clinicalUrl,
        fileMime: fileMime,
        fileSize: normalizedSize,
        recordType: data.record_type,
        status: data.status,
        notes: data.notes || undefined,
        uploadedAt: data.uploaded_at instanceof Date ? data.uploaded_at.toISOString() : String(data.uploaded_at),
        doctorName: data.doctor_name,
        facilityName: data.facility_name,
        dateOfService: data.date_of_service,
        sourceTable: data.source_table
    };
};

// 4. PRESCRIPTION ITEMS
export interface PrescriptionItemResponse {
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
    createdAt?: string;
}

export const mapPrescriptionItemToResponse = (data: PrescriptionItemRow & { created_at?: Date }): PrescriptionItemResponse => {
    return {
        id: data.id,
        prescriptionId: data.prescription_id,
        medicineId: data.medicine_id,
        medicineName: data.medicine_name,
        category: data.category,
        strength: data.strength,
        dosage: data.dosage,
        frequency: data.frequency,
        durationDays: data.duration_days || null,
        quantity: data.quantity || null,
        instructions: data.instructions || null,
        createdAt: data.created_at ? data.created_at.toISOString() : undefined
    };
};
