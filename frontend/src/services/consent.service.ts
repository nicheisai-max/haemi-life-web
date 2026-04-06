import api, { normalizeResponse } from './api';
import type { ApiResponse } from '../types/auth.types';

export interface ConsentRecord {
    id: string;
    agreedAt: string;
    version: string;
}

export const getConsentStatus = async (): Promise<{ hasConsent: boolean }> => {
    const response = await api.get<ApiResponse<{ hasConsent: boolean }>>('/consents/status');
    return normalizeResponse(response);
};

export const signConsent = async (signature: string): Promise<{ message: string; record: ConsentRecord }> => {
    const response = await api.post<ApiResponse<{ message: string; record: ConsentRecord }>>('/consents', { signature });
    return normalizeResponse(response);
};
