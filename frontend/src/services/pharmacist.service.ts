import api, { normalizeResponse } from './api';
import type { ApiResponse } from '../types/auth.types';
import type { PharmacyInventoryEntity, OrderEntity, DashboardStats } from '../types/pharmacist.types';

export const getPharmacistDashboardStats = async (): Promise<DashboardStats> => {
    const response = await api.get<ApiResponse<DashboardStats>>('/pharmacist/dashboard-stats');
    return normalizeResponse(response);
};

export const getPharmacyInventory = async (): Promise<PharmacyInventoryEntity[]> => {
    const response = await api.get<ApiResponse<PharmacyInventoryEntity[]>>('/pharmacist/inventory');
    return normalizeResponse(response);
};

export const getPharmacyOrders = async (): Promise<OrderEntity[]> => {
    const response = await api.get<ApiResponse<OrderEntity[]>>('/pharmacist/orders');
    return normalizeResponse(response);
};

export const approvePharmacyOrder = async (orderId: string): Promise<{ orderId: string }> => {
    const response = await api.post<ApiResponse<{ orderId: string }>>(`/pharmacist/orders/${orderId}/approve`);
    return normalizeResponse(response);
};
export const addPharmacyInventory = async (data: {
    name: string;
    category?: string;
    price: number;
    stock: number;
    minStock?: number;
    expiryDate?: string;
}): Promise<void> => {
    const response = await api.post<ApiResponse<void>>('/pharmacist/inventory', data);
    return normalizeResponse(response);
};
