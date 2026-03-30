/**
 * 🩺 HAEMI LIFE — Clinical Data Mapper
 * Enforces camelCase institutional standard for API responses.
 */

import { AppointmentWithDetails } from '../repositories/appointment.repository';
import { PrescriptionRow, PrescriptionItemRow } from '../repositories/prescription.repository';
import { MedicalRecordRow } from '../repositories/record-repository';

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
    createdAt: Date;
    updatedAt: Date;
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
        createdAt: data.created_at,
        updatedAt: data.updated_at,
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
    prescriptionDate: Date;
    status: string;
    createdAt: Date;
    updatedAt: Date;
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
        prescriptionDate: data.prescription_date,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
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
    filePath: string;
    fileMime?: string;
    fileSize?: string;
    recordType?: string;
    status?: string;
    notes?: string;
    uploadedAt: Date;
    doctorName?: string;
    facilityName?: string;
    dateOfService?: string;
}

export const mapRecordToResponse = (data: MedicalRecordRow): MedicalRecordResponse => {
    return {
        id: data.id,
        patientId: data.patient_id,
        name: data.name,
        filePath: data.file_path,
        fileMime: data.file_mime,
        fileSize: data.file_size,
        recordType: data.record_type,
        status: data.status,
        notes: data.notes || undefined,
        uploadedAt: data.uploaded_at,
        doctorName: data.doctor_name,
        facilityName: data.facility_name,
        dateOfService: data.date_of_service
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
    createdAt?: Date;
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
        createdAt: data.created_at
    };
};
