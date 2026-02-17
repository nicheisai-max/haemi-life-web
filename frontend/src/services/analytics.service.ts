import api from './api';

export interface GrowthStat {
    name: string;
    value: number;
    new_users?: number;
}

export const getGrowthStats = async () => {
    const response = await api.get('/analytics/growth');
    return response.data as GrowthStat[];
};

export const getClinicalPerformance = async () => {
    // This is a placeholder for actual clinical performance metrics
    // In a real app, this would query appointment density and consultation durations
    const response = await api.get('/analytics/performance');
    return response.data;
};

export default {
    getGrowthStats,
    getClinicalPerformance
};
