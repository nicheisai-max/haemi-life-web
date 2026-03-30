import api, { normalizeResponse } from './api';
import type { ApiResponse } from '../types/auth.types';

export interface Medicine {
    id: number;
    name: string;
    category: string;
    description?: string;
    price: number;
    stockQuantity: number;
    minStockLevel: number;
    updatedAt: string;
}

export interface Pharmacy {
    id: string;
    name: string;
    address: string;
    phoneNumber: string;
    email?: string;
}

export const commonService = {
    getLocations: async (): Promise<string[]> => {
        const response = await api.get<ApiResponse<string[]>>('/common/locations');
        return normalizeResponse(response);
    },

    getMedicines: async (): Promise<Medicine[]> => {
        const response = await api.get<ApiResponse<Medicine[]>>('/common/medicines');
        return normalizeResponse(response);
    },

    getPharmacies: async (): Promise<Pharmacy[]> => {
        const response = await api.get<ApiResponse<Pharmacy[]>>('/common/pharmacies');
        return normalizeResponse(response);
    }
};
