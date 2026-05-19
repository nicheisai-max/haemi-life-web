import api, { normalizeResponse } from './api';
import type { ApiResponse } from '../types/auth.types';
import type { PharmacyInventoryEntity, OrderEntity, DashboardStats } from '../types/pharmacist.types';

/**
 * Wire shape of a single slice on the pharmacist dashboard's "Stock
 * Analysis" pie. `name` is the medicine category label (with
 * `'Uncategorized'` fallback for NULL rows on the joined `medicines`
 * row); `value` is the total in-stock units across all
 * `pharmacy_inventory` lines in that category. Returned by
 * `GET /pharmacist/inventory-by-category`; see backend
 * `analyticsRepository#getInventoryByCategory` for the SQL contract.
 *
 * The index signature is mandated by `PremiumPieChart`'s
 * `ChartDataItem` prop contract (which dynamically reads `dataKey` /
 * `categoryKey` properties off each row). It does NOT weaken the
 * wire schema — backend serialisation only emits `name` and `value`
 * — but it lets TS accept this type at the chart's `data` prop
 * without a cast. Matches the established project pattern used by
 * the previous in-file `GrowthDataPoint` literal.
 */
export interface InventoryCategoryStat {
    name: string;
    value: number;
    [key: string]: string | number | undefined;
}

/**
 * Authoritative pending-order counts broken down by subsidy stream.
 * Returned by `GET /pharmacist/order-queue-counts`. The dashboard
 * uses these for the "Pending Orders" KPI card and the two queue-tab
 * badge pills — both of which previously derived `.length` from the
 * LIMIT-50 list payload returned by `GET /pharmacist/orders` and
 * therefore silently capped at 50 once a pharmacy crossed that
 * threshold. The counts here run against the unbounded `orders`
 * table so they remain accurate at any queue size.
 */
export interface OrderQueueCounts {
    pendingDirectTotal: number;
    pendingGovTotal: number;
}

export const getPharmacistDashboardStats = async (): Promise<DashboardStats> => {
    const response = await api.get<ApiResponse<DashboardStats>>('/pharmacist/dashboard-stats');
    return normalizeResponse(response);
};

export const getInventoryByCategory = async (): Promise<InventoryCategoryStat[]> => {
    const response = await api.get<ApiResponse<InventoryCategoryStat[]>>('/pharmacist/inventory-by-category');
    return normalizeResponse(response);
};

export const getOrderQueueCounts = async (): Promise<OrderQueueCounts> => {
    const response = await api.get<ApiResponse<OrderQueueCounts>>('/pharmacist/order-queue-counts');
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
