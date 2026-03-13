import api from './api';

export interface AuditLog {
    id: number; // Institutional Realignment: serial/integer
    user_id: string; // Institutional Realignment: uuid
    action: string;
    entity_type: string;
    entity_id: string; // Institutional Realignment: uuid or text
    details: Record<string, unknown> | string | null;
    ip_address: string;
    created_at: string;
    user_name?: string;
    user_email?: string;
}

export interface SecurityEvent {
    id: string;
    user_id: string | null;
    user_name?: string;
    user_email?: string;
    event_type: string;
    event_category: string | null;
    event_severity: string | null;
    ip_address: string | null;
    is_suspicious: boolean;
    created_at: string;
}

export interface UserSession {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    user_role: string;
    session_id: string;
    ip_address: string | null;
    user_agent: string | null;
    login_time: string;
    last_activity_at: string | null;
    is_active: boolean;
}

export interface RevenueStat {
    name: string;
    revenue: number;
    expenses: number;
}

export interface UserListItem {
    id: string; // Institutional Realignment: uuid
    name: string;
    email: string;
    role: string;
    phone_number: string;
    status: string; // 'ACTIVE', 'INACTIVE'
    initials?: string;
    is_active?: boolean; // Legacy fallback helper
    created_at: string;
}

export interface PendingVerification {
    id: string; // Institutional Realignment: uuid
    name: string;
    email: string;
    phone_number: string;
    created_at: string;
    specialization: string;
    license_number: string;
    years_of_experience: number;
    bio: string;
}

export interface SystemStats {
    total_patients: number;
    active_doctors: number;
    pending_verifications: number;
    scheduled_appointments: number;
    pending_prescriptions: number;
    active_users: number;
    total_users: number; // Added: Parity with backend
}

// Named exports for components that expect direct imports
export const getAuditLogs = async (limit = 50, offset = 0): Promise<AuditLog[]> => {
    const response = await api.get<AuditLog[]>('/admin/audit-logs', { params: { limit, offset } });
    return response.data;
};

export const getAllUsers = async (params?: { role?: string; status?: string; search?: string }): Promise<UserListItem[]> => {
    const response = await api.get<UserListItem[]>('/admin/users', { params });
    return response.data;
};

export const updateUserStatus = async (userId: string, status: string): Promise<{ message: string; user: UserListItem }> => {
    const response = await api.put<{ message: string; user: UserListItem }>(`/admin/users/${userId}/status`, { status });
    return response.data;
};

export const getPendingVerifications = async (): Promise<PendingVerification[]> => {
    const response = await api.get<PendingVerification[]>('/admin/pending-verifications');
    return response.data;
};

export const verifyDoctor = async (id: string, verified: boolean): Promise<{ message: string; profile: PendingVerification }> => {
    const response = await api.put<{ message: string; profile: PendingVerification }>(`/admin/verify-doctor/${id}`, { verified });
    return response.data;
};

export const getSystemStats = async (): Promise<SystemStats> => {
    const response = await api.get<SystemStats>('/admin/system-stats');
    return response.data;
};

export const getSecurityEvents = async (limit = 50, offset = 0): Promise<SecurityEvent[]> => {
    const response = await api.get<SecurityEvent[]>('/admin/security-events', { params: { limit, offset } });
    return response.data;
};

export const getActiveSessions = async (limit = 50, offset = 0): Promise<UserSession[]> => {
    const response = await api.get<UserSession[]>('/admin/active-sessions', { params: { limit, offset } });
    return response.data;
};

export const revokeSession = async (sessionId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete<{ success: boolean; message: string }>(`/admin/sessions/${sessionId}`);
    return response.data;
};

export const getRevenueStats = async (): Promise<RevenueStat[]> => {
    const response = await api.get<RevenueStat[]>('/admin/revenue-stats');
    return response.data;
};

// Object-based export for backward compatibility
export const adminSettingsService = {
    getSessionTimeout: async (): Promise<{ timeout: number }> => {
        const response = await api.get<{ timeout: number }>('/admin/settings/session-timeout');
        return response.data;
    },

    updateSessionTimeout: async (timeout: number): Promise<{ message: string; timeout: number }> => {
        const response = await api.put<{ message: string; timeout: number }>('/admin/settings/session-timeout', { timeout });
        return response.data;
    }
};
