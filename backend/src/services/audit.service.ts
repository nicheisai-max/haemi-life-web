import { pool } from '../config/db';
import { logger } from '../utils/logger';

// CANONICAL ANONYMOUS IDENTITY (Zero-Trust Compliant)
export const SYSTEM_ANONYMOUS_ID = '00000000-0000-0000-0000-000000000000';

export interface AuditLogEntry {
    userId: string; // Mandatory per Zero-Trust Identity Policy
    actorRole?: string;
    actionType: string;
    targetId?: string;
    entityId?: string;
    action?: string;
    details?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    accessTokenJti?: string;
    refreshTokenJti?: string;
    deviceType?: string;
}

export const auditService = {
    log: async (entry: AuditLogEntry) => {
        try {
            // ZERO-TRUST CANONICAL IDENTITY ENFORCEMENT
            if (!entry.userId) {
                throw new Error("Identity policy violation: userId required");
            }

            const userId = entry.userId;
            const action = entry.action || entry.actionType || 'UNKNOWN_ACTION';
            const entityId = entry.entityId || entry.targetId || null;
            const details = entry.details || 
                (entry.metadata ? JSON.stringify(entry.metadata) : null) || 
                '{}';
            const ipAddress = entry.ipAddress || null;
            const userAgent = entry.userAgent || null;
            
            if (!action || action === 'UNKNOWN_ACTION') return;

            await pool.query(
                `INSERT INTO audit_logs (
                    user_id, action, entity_id, details, 
                    ip_address, user_agent, created_at
                )
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                [
                    userId,
                    action,
                    entityId,
                    details,
                    ipAddress,
                    userAgent
                ]
            );
        } catch (error: unknown) {
            logger.error('Failed to write audit log', { 
                error: error instanceof Error ? error.message : String(error),
                userId: entry.userId,
                action: entry.action || entry.actionType
            });
        }
    }
};
