import api, { normalizeResponse } from './api';
import type { ApiResponse } from '../types/auth.types';

export interface MedicalRecord {
    id: string;
    patientId: string;
    name: string;
    filePath: string;
    fileMime: string;
    fileSize: string;
    uploadedAt: string;
    recordType?: string;
    status?: string;
    notes?: string;
    doctorName?: string;
    facilityName?: string;
    dateOfService?: string;
}


export const getMyRecords = async (): Promise<MedicalRecord[]> => {
    const response = await api.get<ApiResponse<MedicalRecord[]>>('/records');
    return normalizeResponse(response);
};

export const uploadRecord = async (file: File): Promise<MedicalRecord> => {
    const formData = new FormData();
    formData.append('file', file);

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
