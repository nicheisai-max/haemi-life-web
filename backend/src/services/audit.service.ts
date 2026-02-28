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
}

export const auditService = {
    log: async (entry: AuditLogEntry) => {
        try {
            await pool.query(
                `INSERT INTO audit_logs (actor_id, actor_role, action_type, target_id, metadata, ip_address, user_agent, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                [
                    entry.actor_id || null,
                    entry.actor_role || null,
                    entry.action_type,
                    entry.target_id || null,
                    entry.metadata || {},
                    entry.ip_address || null,
                    entry.user_agent || null
                ]
            );
        } catch (error) {
            // Fallback to file logger if DB fails - do not crash request
            logger.error('Failed to write audit log', { error, entry });
        }
    }
};
