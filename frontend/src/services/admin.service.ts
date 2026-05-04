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
    /**
     * Aligned with the backend wire shape (`security.repository.ts`):
     * the backend LEFT-JOINs `users` and explicitly returns `null`
     * when the audit event has no associated user (system-originated
     * actions). Using `string | null` here is more honest than the
     * previous `string | undefined` — `JSON.stringify` preserves null
     * but drops undefined, so the over-the-wire reality is null.
     */
    userName: string | null;
    userEmail: string | null;
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
    /**
     * Server-side parsed UA fields persisted at session creation time
     * (`user_sessions.browser_name` / `os_name` / `device_type` columns).
     * Phase 3 surfaces these in the admin Sessions page so the device
     * column reads "Chrome 124 · macOS · Desktop" rather than the raw
     * user-agent string. The columns can be `null` for sessions
     * created before the parser was added to the signup/login flow —
     * consumers fall back to `userAgent` in that case.
     */
    browserName?: string | null;
    osName?: string | null;
    deviceType?: string | null;
    createdAt: string;
    // P1 CASING FIX (Phase 12): camelCase across the API surface.
    lastActivity: string | null;
    isActive: boolean;
    profileImage?: string | null;
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
    /**
     * Last-seen timestamp from `users.last_activity`. Phase 4 surfaces
     * this in the admin User Management page so admins can see who is
     * active right now versus dormant. `null` for users who have never
     * had a session (newly-registered, no first login yet) — the UI
     * renders a fallback string (e.g. "Never").
     */
    lastActivity: string | null;
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
    /**
     * Optional richer profile fields backfilled by the doctor through
     * the profile completion flow. Surfaced on the admin Verify Doctors
     * card in Phase 3 so admins can review the full clinical profile
     * before approving — replaces the previous bare name/license-only
     * card. `null` (not undefined) when the doctor has yet to complete
     * the profile, mirroring the DB column nullability honestly.
     */
    consultationFee?: number | null;
    canVideoConsult?: boolean | null;
    profileImage?: string | null;
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

export interface PaginatedResponse<T> {
    users: T[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

// ─── Audit logs (server-side filter + pagination) ───────────────────────────
//
// Backend returns `{ items, pagination: { total, limit, offset } }` so the
// admin UI can render an accurate "X of Y" footer and disable next-page
// when the result set is exhausted. All filter params are optional —
// passing none returns the most recent page across all logs.
export interface AuditLogQuery {
    readonly limit?: number;
    readonly offset?: number;
    readonly q?: string;
    readonly action?: string;
    readonly entityType?: string;
}

export interface AuditLogPage {
    readonly items: ReadonlyArray<AuditLog>;
    readonly pagination: {
        readonly total: number;
        readonly limit: number;
        readonly offset: number;
    };
}

export const getAuditLogs = async (query: AuditLogQuery = {}): Promise<AuditLogPage> => {
    // Compose query params explicitly so empty / null filters are NOT sent
    // as `?q=` or `?action=` (which the backend would interpret as "exact
    // match on empty string"). Numeric defaults are always sent.
    const params: Record<string, string | number> = {
        limit: query.limit ?? 50,
        offset: query.offset ?? 0,
    };
    if (query.q !== undefined && query.q.length > 0) params.q = query.q;
    if (query.action !== undefined && query.action.length > 0) params.action = query.action;
    if (query.entityType !== undefined && query.entityType.length > 0) params.entityType = query.entityType;

    const response = await api.get<ApiResponse<AuditLogPage>>('/admin/audit-logs', { params });
    return normalizeResponse(response);
};

export const getAllUsers = async (params?: { 
    role?: string; 
    status?: string; 
    search?: string; 
    page?: number; 
    limit?: number 
}): Promise<PaginatedResponse<UserListItem>> => {
    const response = await api.get<ApiResponse<PaginatedResponse<UserListItem>>>('/admin/users', { params });
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

// ─── System health (Phase 5) ─────────────────────────────────────────────────
//
// Returned by `GET /admin/system-health` — the admin dashboard polls this
// every 5 seconds (Phase 5 design) to render its System Load card live.
// Field shapes mirror the backend wire schema in
// `admin.controller.getSystemHealth` exactly; values are integer-rounded
// percentages clamped to [0, 100] on the server side.
export interface DbConnectionStats {
    readonly total: number;
    readonly idle: number;
    readonly waiting: number;
}

export interface SystemHealth {
    readonly cpuPercent: number;
    readonly memoryPercent: number;
    readonly dbConnections: DbConnectionStats;
    readonly uptimeSeconds: number;
    readonly timestamp: string;
}

export const getSystemHealth = async (): Promise<SystemHealth> => {
    const response = await api.get<ApiResponse<SystemHealth>>('/admin/system-health');
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
