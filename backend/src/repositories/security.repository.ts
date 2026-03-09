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
    created_at: Date;
    last_activity: Date | null;
    revoked: boolean;
}

export const securityRepository = {
    async getSecurityEvents(limit: number = 50, offset: number = 0): Promise<SecurityEvent[]> {
        // Fallback to audit_logs for security analysis
        const result = await pool.query(
            `SELECT al.id, al.actor_user_id as user_id, u.role as user_role, 
             al.action_type as event_type, al.request_ip as ip_address, 
             al.user_agent, al.created_at, u.name as user_name, u.email as user_email 
             FROM audit_logs al
             LEFT JOIN users u ON al.actor_user_id = u.id
             WHERE al.action_type LIKE '%SECURITY%' OR al.action_type LIKE '%LOGIN%' OR al.action_type LIKE '%REVOKE%'
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
        const result = await pool.query(
            `SELECT us.*, u.name as user_name, u.email as user_email 
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
        const result = await pool.query(
            `UPDATE user_sessions 
             SET revoked = TRUE, revoked_at = NOW() 
             WHERE session_id = $1 OR id::text = $1
             RETURNING id`,
            [sessionId]
        );
        return result.rows.length > 0;
    }
};
