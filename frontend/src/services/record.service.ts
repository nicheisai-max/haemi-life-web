import api from './api';

export interface MedicalRecord {
    id: string;
    name: string;
    file_path: string;
    file_type: string;
    file_size: string;
    uploaded_at: string;
}

export const getMyRecords = async (): Promise<MedicalRecord[]> => {
    const response = await api.get('/records');
    return response.data;
};

export const uploadRecord = async (file: File): Promise<MedicalRecord> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/records/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data.record;
};

export const deleteRecord = async (id: string): Promise<void> => {
    await api.delete(`/records/${id}`);
};
