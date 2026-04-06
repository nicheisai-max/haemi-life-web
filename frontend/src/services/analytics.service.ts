import api, { normalizeResponse } from './api';
import type { ApiResponse } from '../types/auth.types';

export interface GrowthStat {
    name: string;
    value: number;
    newUsers?: number;
    [key: string]: string | number | undefined;
}

export interface DiagnosisEntry {
    name: string;
    count: number;
    percentage: number;
}

export interface ClinicalPerformance {
    retentionRate?: string | number;
    patientSatisfaction?: string | number;
    topDiagnoses?: DiagnosisEntry[];
}

export const getGrowthStats = async () => {
    const response = await api.get<ApiResponse<GrowthStat[]>>('/analytics/growth');
    return normalizeResponse(response);
};

export const getClinicalPerformance = async (): Promise<ClinicalPerformance> => {
    const response = await api.get<ApiResponse<ClinicalPerformance>>('/analytics/performance');
    return normalizeResponse(response);
};

export default {
    getGrowthStats,
    getClinicalPerformance
};
