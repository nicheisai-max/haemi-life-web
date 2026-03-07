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
    login_time: Date;
    last_activity_at: Date | null;
    is_active: boolean;
}

export const securityRepository = {
    async getSecurityEvents(limit: number = 50, offset: number = 0): Promise<SecurityEvent[]> {
        const result = await pool.query(
            `SELECT se.*, u.name as user_name, u.email as user_email 
             FROM security_events se
             LEFT JOIN users u ON se.user_id = u.id
             ORDER BY se.created_at DESC 
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return result.rows;
    },

    async getActiveSessions(limit: number = 50, offset: number = 0): Promise<UserSession[]> {
        const result = await pool.query(
            `SELECT us.*, u.name as user_name, u.email as user_email 
             FROM user_sessions us
             JOIN users u ON us.user_id = u.id
             WHERE us.is_active = TRUE
             ORDER BY us.last_activity_at DESC NULLS LAST
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        return result.rows;
    },

    async revokeSession(sessionId: string): Promise<boolean> {
        const result = await pool.query(
            `UPDATE user_sessions 
             SET is_active = FALSE, logout_time = NOW(), logout_reason = 'REVOKED_BY_ADMIN'
             WHERE session_id = $1 OR id::text = $1
             RETURNING id`,
            [sessionId]
        );
        return result.rows.length > 0;
    }
};
