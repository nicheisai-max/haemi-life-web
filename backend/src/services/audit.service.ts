import { pool } from '../config/db';
import { logger } from '../utils/logger';

// CANONICAL ANONYMOUS IDENTITY (Zero-Trust Compliant)
export const SYSTEM_ANONYMOUS_ID = '00000000-0000-0000-0000-000000000000';

export interface AuditLogEntry {
    user_id: string; // Mandatory per Zero-Trust Identity Policy
    actor_role?: string;
    action_type: string;
    target_id?: string;
    entity_id?: string;
    action?: string;
    details?: string;
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
            // ZERO-TRUST CANONICAL IDENTITY ENFORCEMENT
            if (!entry.user_id) {
                throw new Error("Identity policy violation: user_id required");
            }

            const user_id = entry.user_id;
            const action = entry.action || entry.action_type || 'UNKNOWN_ACTION';
            const entity_id = entry.entity_id || entry.target_id || null;
            const details = entry.details || 
                (entry.metadata ? JSON.stringify(entry.metadata) : null) || 
                '{}';
            const ip_address = entry.ip_address || null;
            const user_agent = entry.user_agent || null;
            
            if (!action || action === 'UNKNOWN_ACTION') return;

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
