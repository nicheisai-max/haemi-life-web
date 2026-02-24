import api from './api';

export interface ConsentRecord {
    id: string;
    agreed_at: string;
    version: string;
}

export const getConsentStatus = async (): Promise<{ hasConsent: boolean }> => {
    const response = await api.get('/consents/status');
    return response.data;
};

export const signConsent = async (signature: string): Promise<{ message: string; record: ConsentRecord }> => {
    const response = await api.post('/consents', { signature });
    return response.data;
};
