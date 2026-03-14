import { pool } from '../config/db';
import { logger } from '../utils/logger';

export interface AuditLogEntry {
    user_id?: string;
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
            // SCHEMA ALIGNMENT: user_id is the canonical identifier
            const user_id = entry.user_id || null;
            const action = entry.action || entry.action_type || 'UNKNOWN_ACTION';
            const entity_id = entry.entity_id || entry.target_id || null;
            const details = entry.details || 
                (entry.metadata ? JSON.stringify(entry.metadata) : null) || 
                '{}';
            const ip_address = entry.ip_address || entry.request_ip || null;
            const user_agent = entry.user_agent || null;
            
            if (!action) return;

            await pool.query(
                `INSERT INTO audit_logs (
                    user_id, action, entity_id, details, 
                    ip_address, user_agent, created_at
                )
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                [
                    user_id,
                    action,
                    entity_id,
                    details,
                    ip_address,
                    user_agent
                ]
            );
        } catch (error) {
            logger.error('Failed to write audit log', { error, entry });
        }
    }
};
