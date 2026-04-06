import api, { normalizeResponse } from './api';
import type { ApiResponse } from '../types/auth.types';
import { ClinicalRecordType } from '../../../shared/clinical-types';

export interface MedicalRecord {
    id: string;
    patientId: string;
    name: string;
    url: string;
    fileMime: string;
    fileSize: string;
    uploadedAt: string;
    recordType: ClinicalRecordType;
    status?: string;
    notes?: string;
    doctorName?: string;
    facilityName?: string;
    dateOfService?: string;
}


export const getMyRecords = async (type?: ClinicalRecordType): Promise<MedicalRecord[]> => {
    const response = await api.get<ApiResponse<MedicalRecord[]>>('/records', {
        params: { type }
    });
    return normalizeResponse(response);
};

export const uploadRecord = async (file: File, recordType: ClinicalRecordType): Promise<MedicalRecord> => {
    const formData = new FormData();
    formData.append('file', file);
    if (recordType) formData.append('recordType', recordType);

    const response = await api.post<ApiResponse<{ record: MedicalRecord }>>('/records/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return normalizeResponse(response).record;
};

export const deleteRecord = async (id: string): Promise<void> => {
    const response = await api.delete<ApiResponse<void>>(`/records/${id}`);
    normalizeResponse(response);
};

// 🔍 Forensic Check: Verify if a name already exists (including soft-deleted)
export const checkFileExistence = async (name: string): Promise<{ exists: boolean; record?: MedicalRecord }> => {
    const response = await api.get<ApiResponse<{ exists: boolean; record?: MedicalRecord }>>('/records/exists', {
        params: { name }
    });
    return normalizeResponse(response);
};
