import { pool } from '../config/db';

export interface SecurityEvent {
    id: string;
    user_id: string | null;
    user_role: string | null;
    event_type: string;
    event_category: string | null;
    event_severity: string | null;
    ip_address: string | null;
    user_agent: string | null;
    is_suspicious: boolean;
    created_at: Date;
}

export interface UserSession {
    id: string;
    user_id: string;
    user_role: string;
    session_id: string;
    ip_address: string | null;
    user_agent: string | null;
    browser_name: string | null;
    os_name: string | null;
    device_type: string | null;
    created_at: Date;
    last_activity: Date | null;
    revoked: boolean;
}

interface SecurityEventRow {
    id: string;
    user_id: string | null;
    user_role: string | null;
    event_type: string;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Date;
    user_name: string | null;
    user_email: string | null;
}

interface UserSessionRow extends UserSession {
    user_name: string;
    user_email: string;
}

export const securityRepository = {
    async getSecurityEvents(limit: number = 50, offset: number = 0): Promise<SecurityEvent[]> {
        // Fallback to audit_logs for security analysis
        const result = await pool.query<SecurityEventRow>(
            `SELECT al.id, al.user_id, u.role as user_role, 
             al.action as event_type, al.ip_address, 
             al.user_agent, al.created_at, u.name as user_name, u.email as user_email 
             FROM audit_logs al
             LEFT JOIN users u ON al.user_id = u.id
             WHERE al.action LIKE '%SECURITY%' OR al.action LIKE '%LOGIN%' OR al.action LIKE '%REVOKE%'
             ORDER BY al.created_at DESC 
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return result.rows.map(row => ({
            ...row,
            event_category: 'Audit',
            event_severity: 'Info',
            is_suspicious: false
        }));
    },

    async getActiveSessions(limit: number = 50, offset: number = 0): Promise<UserSession[]> {
        const result = await pool.query<UserSessionRow>(
            `SELECT us.id, us.user_id, us.user_role, us.session_id, us.ip_address, 
             us.user_agent, us.browser_name, us.os_name, us.device_type, 
             us.created_at, us.last_activity, us.revoked,
             u.name as user_name, u.email as user_email 
             FROM user_sessions us
             JOIN users u ON us.user_id = u.id
             WHERE us.revoked = FALSE
             ORDER BY us.last_activity DESC NULLS LAST
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return result.rows;
    },

    async revokeSession(sessionId: string): Promise<boolean> {
        const result = await pool.query<{ id: string }>(
            `UPDATE user_sessions 
             SET revoked = TRUE, logout_time = NOW() 
             WHERE session_id = $1 OR id::text = $1
             RETURNING id`,
            [sessionId]
        );
        return result.rows.length > 0;
    }
};
