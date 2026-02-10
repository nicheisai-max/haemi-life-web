import api from './api';

// =====================================================
// ADMIN API SERVICE
// =====================================================

export interface PendingVerification {
    id: number;
    name: string;
    email: string;
    phone_number: string;
    created_at: string;
    specialization?: string;
    license_number?: string;
    years_of_experience?: number;
    bio?: string;
}

export interface UserListItem {
    id: number;
    name: string;
    email?: string;
    phone_number: string;
    role: string;
    is_active: boolean;
    created_at: string;
}

export interface SystemStats {
    total_patients: number;
    active_doctors: number;
    pending_verifications: number;
    scheduled_appointments: number;
    pending_prescriptions: number;
    active_users: number;
}

export interface AuditLog {
    id: number;
    user_id: number;
    action: string;
    entity_type?: string;
    entity_id?: number;
    details?: any;
    ip_address?: string;
    created_at: string;
    user_name?: string;
    user_email?: string;
    user_role?: string;
}

// Get pending doctor verifications
export const getPendingVerifications = async () => {
    const response = await api.get('/admin/pending-verifications');
    return response.data as PendingVerification[];
};

// Verify or reject a doctor
export const verifyDoctor = async (id: number, verified: boolean) => {
    const response = await api.put(`/admin/verify-doctor/${id}`, { verified });
    return response.data;
};

// Get all users with filters
export const getAllUsers = async (params?: {
    role?: string;
    is_active?: boolean;
    search?: string;
}) => {
    const response = await api.get('/admin/users', { params });
    return response.data as UserListItem[];
};

// Update user status (activate/deactivate)
export const updateUserStatus = async (id: number, is_active: boolean) => {
    const response = await api.put(`/admin/users/${id}/status`, { is_active });
    return response.data;
};

// Get system statistics
export const getSystemStats = async () => {
    const response = await api.get('/admin/system-stats');
    return response.data as SystemStats;
};

// Get audit logs
export const getAuditLogs = async (params?: { limit?: number; offset?: number }) => {
    const response = await api.get('/admin/audit-logs', { params });
    return response.data as AuditLog[];
};

export default {
    getPendingVerifications,
    verifyDoctor,
    getAllUsers,
    updateUserStatus,
    getSystemStats,
    getAuditLogs
};
