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
    log: async (entry: Partial<AuditLogEntry> & Record<string, unknown>) => {
        try {
            // SCHEMA GUARDS & LEGACY COMPATIBILITY
            // Map common legacy property names to the new enterprise schema
            const actor_user_id = entry.actor_user_id || entry.actor_id || entry.user_id;
            const action_type = entry.action_type || entry.action || 'UNKNOWN_ACTION';
            const target_id = entry.target_entity_id || entry.target_id || entry.entity_id;
            const change_summary = entry.change_summary ||
                (entry.metadata ? JSON.stringify(entry.metadata) : null) ||
                (entry.details ? JSON.stringify(entry.details) : '{}');
            const request_ip = entry.request_ip || entry.ip_address || null;

            if (!action_type) return; // Silent discard if no action type provided

            await pool.query(
                `INSERT INTO audit_logs (actor_user_id, action_type, target_entity_id, change_summary, request_ip, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())`,
                [
                    actor_user_id || null,
                    action_type,
                    target_id || null,
                    change_summary,
                    request_ip
                ]
            );
        } catch (error) {
            // Fallback to file logger if DB fails - do not crash request
            logger.error('Failed to write audit log', { error, entry });
        }
    }
};
