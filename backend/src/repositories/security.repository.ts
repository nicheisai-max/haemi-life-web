import { pool } from '../config/db';
import { logger } from '../utils/logger';

export interface SecurityEvent {
    id: string;
    userId: string | null;
    userRole: string | null;
    eventType: string;
    eventCategory: string | null;
    eventSeverity: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    isSuspicious: boolean;
    createdAt: Date;
}

export interface UserSession {
    id: string;
    userId: string;
    userRole: string;
    sessionId: string;
    ipAddress: string | null;
    userAgent: string | null;
    browserName: string | null;
    osName: string | null;
    deviceType: string | null;
    createdAt: Date;
    lastActivity: Date | string | null;
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

interface UserSessionRow {
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
    lastActivity: Date | null;
    revoked: boolean;
    user_name: string;
    user_email: string;
}

export const securityRepository = {
    async getSecurityEvents(limit: number = 50, offset: number = 0): Promise<SecurityEvent[]> {
        try {
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
                id: row.id,
                userId: row.user_id,
                userRole: row.user_role,
                eventType: row.event_type,
                ipAddress: row.ip_address,
                userAgent: row.user_agent,
                createdAt: row.created_at,
                eventCategory: 'Audit',
                eventSeverity: 'Info',
                isSuspicious: false
            }));
        } catch (error: unknown) {
            logger.error('Failed to fetch security events', {
                error: error instanceof Error ? error.message : String(error),
                limit,
                offset
            });
            throw error;
        }
    },

    async getActiveSessions(limit: number = 50, offset: number = 0): Promise<UserSession[]> {
        try {
            const result = await pool.query<UserSessionRow>(
                `SELECT us.id, us.user_id, us.user_role, us.session_id, us.ip_address, 
                 us.ip_address, us.user_agent, us.browser_name, us.os_name, us.device_type,
                 us.created_at, us."lastActivity", us.revoked,
                 u.name as user_name, u.email as user_email 
                 FROM user_sessions us
                 JOIN users u ON us.user_id = u.id
                 WHERE us.revoked = FALSE
                 ORDER BY us."lastActivity" DESC NULLS LAST
                 LIMIT $1 OFFSET $2`,
                [limit, offset]
            );
            return result.rows.map(row => ({
                id: row.id,
                userId: row.user_id,
                userRole: row.user_role,
                sessionId: row.session_id,
                ipAddress: row.ip_address,
                userAgent: row.user_agent,
                browserName: row.browser_name,
                osName: row.os_name,
                deviceType: row.device_type,
                createdAt: row.created_at,
                lastActivity: row.lastActivity,
                revoked: row.revoked
            }));
        } catch (error: unknown) {
            logger.error('Failed to fetch active sessions', {
                error: error instanceof Error ? error.message : String(error),
                limit,
                offset
            });
            throw error;
        }
    },

    async revokeSession(sessionId: string): Promise<boolean> {
        try {
            const result = await pool.query<{ id: string }>(
                `UPDATE user_sessions 
                 SET revoked = TRUE, logout_time = NOW() 
                 WHERE session_id = $1 OR id::text = $1
                 RETURNING id`,
                [sessionId]
            );
            return result.rows.length > 0;
        } catch (error: unknown) {
            logger.error('Failed to revoke session', {
                error: error instanceof Error ? error.message : String(error),
                sessionId
            });
            throw error;
        }
    }
};
