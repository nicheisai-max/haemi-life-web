import api, { normalizeResponse } from './api';
import type { ApiResponse } from '../types/auth.types';

export interface AuditLog {
    id: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    details: Record<string, unknown> | string | null;
    ipAddress: string;
    createdAt: string;
    userName?: string;
    userEmail?: string;
}

export interface SecurityEvent {
    id: string;
    userId: string | null;
    userName?: string;
    userEmail?: string;
    eventType: string;
    eventCategory: string | null;
    eventSeverity: string | null;
    ipAddress: string | null;
    isSuspicious: boolean;
    createdAt: string;
}

export interface UserSession {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    userRole: string;
    sessionId: string;
    ipAddress: string | null;
    userAgent: string | null;
    loginTime: string;
    last_activity: string | null;
    isActive: boolean;
}

export interface RevenueStat {
    name: string;
    revenue: number;
    expenses: number;
}

export interface UserListItem {
    id: string;
    name: string;
    email: string;
    role: string;
    phoneNumber: string;
    status: string;
    initials?: string;
    profileImage: string | null;
    createdAt: string;
}

export interface PendingVerification {
    id: string;
    name: string;
    email: string;
    phoneNumber: string;
    createdAt: string;
    specialization: string;
    licenseNumber: string;
    yearsOfExperience: number;
    bio: string;
}

export interface SystemStats {
    totalPatients: number;
    activeDoctors: number;
    pendingVerifications: number;
    scheduledAppointments: number;
    pendingPrescriptions: number;
    activeUsers: number;
    totalUsers: number; 
}

// Named exports for components that expect direct imports
export const getAuditLogs = async (limit = 50, offset = 0): Promise<AuditLog[]> => {
    const response = await api.get<ApiResponse<AuditLog[]>>('/admin/audit-logs', { params: { limit, offset } });
    return normalizeResponse(response);
};

export const getAllUsers = async (params?: { role?: string; status?: string; search?: string }): Promise<UserListItem[]> => {
    const response = await api.get<ApiResponse<UserListItem[]>>('/admin/users', { params });
    return normalizeResponse(response);
};

export const updateUserStatus = async (userId: string, status: string): Promise<{ message: string; user: UserListItem }> => {
    const response = await api.put<ApiResponse<{ message: string; user: UserListItem }>>(`/admin/users/${userId}/status`, { status });
    return normalizeResponse(response);
};

export const getPendingVerifications = async (): Promise<PendingVerification[]> => {
    const response = await api.get<ApiResponse<PendingVerification[]>>('/admin/pending-verifications');
    return normalizeResponse(response);
};

export const verifyDoctor = async (id: string, verified: boolean): Promise<{ message: string; profile: PendingVerification }> => {
    const response = await api.put<ApiResponse<{ message: string; profile: PendingVerification }>>(`/admin/verify-doctor/${id}`, { verified });
    return normalizeResponse(response);
};

export const getSystemStats = async (): Promise<SystemStats> => {
    const response = await api.get<ApiResponse<SystemStats>>('/admin/system-stats');
    return normalizeResponse(response);
};

export const getSecurityEvents = async (limit = 50, offset = 0): Promise<SecurityEvent[]> => {
    const response = await api.get<ApiResponse<SecurityEvent[]>>('/admin/security-events', { params: { limit, offset } });
    return normalizeResponse(response);
};

export const getActiveSessions = async (limit = 50, offset = 0): Promise<UserSession[]> => {
    const response = await api.get<ApiResponse<UserSession[]>>('/admin/active-sessions', { params: { limit, offset } });
    return normalizeResponse(response);
};

export const revokeSession = async (sessionId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete<ApiResponse<{ success: boolean; message: string }>>(`/admin/sessions/${sessionId}`);
    return normalizeResponse(response);
};

export const getRevenueStats = async (): Promise<RevenueStat[]> => {
    const response = await api.get<ApiResponse<RevenueStat[]>>('/admin/revenue-stats');
    return normalizeResponse(response);
};

// Object-based export for backward compatibility
export const adminSettingsService = {
    getSessionTimeout: async (): Promise<{ timeout: number }> => {
        const response = await api.get<ApiResponse<{ timeout: number }>>('/admin/settings/session-timeout');
        return normalizeResponse(response);
    },

    updateSessionTimeout: async (timeout: number): Promise<{ message: string; timeout: number }> => {
        const response = await api.put<ApiResponse<{ message: string; timeout: number }>>('/admin/settings/session-timeout', { timeout });
        return normalizeResponse(response);
    }
};
