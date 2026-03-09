import { pool } from '../config/db';
import { logger } from '../utils/logger';

export interface AuditLogEntry {
    actor_id?: string;
    actor_role?: string;
    action_type: string;
    target_id?: string;
    metadata?: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    session_id?: string;
    access_token_jti?: string;
    refresh_token_jti?: string;
    device_type?: string;
}

export const auditService = {
    log: async (entry: Partial<AuditLogEntry> & Record<string, unknown>) => {
        try {
            // SCHEMA GUARDS & LEGACY COMPATIBILITY
            const actor_user_id = entry.actor_user_id || entry.actor_id || entry.user_id;
            const action_type = entry.action_type || entry.action || 'UNKNOWN_ACTION';
            const target_id = entry.target_entity_id || entry.target_id || entry.entity_id;
            const change_summary = entry.change_summary ||
                (entry.metadata ? JSON.stringify(entry.metadata) : null) ||
                (entry.details ? JSON.stringify(entry.details) : '{}');
            const request_ip = entry.request_ip || entry.ip_address || null;
            const user_agent = entry.user_agent || null;
            const session_id = entry.session_id || null;
            const access_jti = entry.access_token_jti || null;
            const refresh_jti = entry.refresh_token_jti || null;
            const device_type = entry.device_type || null;

            if (!action_type) return;

            await pool.query(
                `INSERT INTO audit_logs (
                    actor_user_id, action_type, target_entity_id, change_summary, 
                    request_ip, user_agent, session_id, access_token_jti, 
                    refresh_token_jti, device_type, created_at
                )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
                [
                    actor_user_id || null,
                    action_type,
                    target_id || null,
                    change_summary,
                    request_ip,
                    user_agent,
                    session_id,
                    access_jti,
                    refresh_jti,
                    device_type
                ]
            );
        } catch (error) {
            logger.error('Failed to write audit log', { error, entry });
        }
    }
};
