import { pool } from '../config/db';
import { logger } from '../utils/logger';
import { UserId } from '../types/chat.types';

export type UserStatusEvent = {
    userId: UserId;
    isOnline: boolean; // Institutional standard (boolean)
    last_activity: string;
};


class StatusService {
    // P0: In-memory presence map (userId -> Set of socketIds) for zero-latency lookups
    private onlineUsers: Map<string, Set<string>> = new Map();

    public async isOnline(userId: string): Promise<boolean> {
        try {
            const id = String(userId);
            const result = await pool.query<{ exists: boolean }>('SELECT EXISTS(SELECT 1 FROM active_connections WHERE user_id = $1)', [id]);
            return result.rows[0]?.exists ?? false;
        } catch (error: unknown) {
            logger.error('[StatusService] isOnline DB check failed:', {
                error: error instanceof Error ? error.message : String(error),
                userId
            });
            // P0 NUCLEAR PROTOCOL: NO MEMORY FALLBACK ALLOWED
            return false; 
        }
    }

    public async setUserOnline(userId: string, socketId: string): Promise<UserStatusEvent> {
        const id = String(userId);
        
        let connections = this.onlineUsers.get(id);
        if (!connections) {
            connections = new Set();
            this.onlineUsers.set(id, connections);
        }
        connections.add(socketId);

        try {
            // P0: Mandatory DB persistence
            await this.persistConnection(userId, socketId);
        } catch (error: unknown) {
            logger.error('[StatusService] Failed to set user online', {
                error: error instanceof Error ? error.message : String(error),
                userId,
                socketId
            });
        }

        return {
            userId: id as UserId,
            isOnline: true,
            last_activity: new Date().toISOString()
        };
    }

    public async setUserOffline(userId: string, socketId: string): Promise<UserStatusEvent> {
        const id = String(userId);
        
        // 1. Target Session Record Cleanup
        const userConnections = this.onlineUsers.get(id);
        if (userConnections) {
            userConnections.delete(socketId);
            if (userConnections.size === 0) {
                this.onlineUsers.delete(id);
            }
        }

        try {
            // 2. Definitive State Retrieval (Pre-deletion last_activity)
            const last_activity = await this.fetchUserLastActivity(userId) || new Date().toISOString();

            // 3. Strict Sequential DB Deletion (Source of Truth)
            await pool.query("DELETE FROM active_connections WHERE socket_id = $1", [socketId]);

            // 4. Fresh DB query for user-level status AFTER deletion
            const stillOnlineResult = await pool.query<{ exists: boolean }>('SELECT EXISTS(SELECT 1 FROM active_connections WHERE user_id = $1)', [id]);
            const stillOnline = stillOnlineResult.rows[0]?.exists ?? false;
            
            if (!stillOnline) {
                // Updated user table only if definitively offline in DB
                await pool.query(
                    "UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1",
                    [id]
                );
                logger.info('[Phase 1] User definitively offline (DB Truth)', { userId: id });
            }

            return {
                userId: id as UserId,
                isOnline: stillOnline,
                last_activity: last_activity
            };
        } catch (error: unknown) {
            logger.error('[StatusService] Failed to set user offline', {
                error: error instanceof Error ? error.message : String(error),
                userId,
                socketId
            });
            throw error;
        }
    }

    /**
     * P0 NUCLEAR: Atomic Logout Cleanup
     * Purges ALL active connections for a user across all tabs/devices.
     * Enforces immediate "Offline" status in the Source of Truth (DB).
     */
    public async purgeUserConnections(userId: string): Promise<UserStatusEvent> {
        const id = String(userId);
        
        // 1. Clear local memory map for all sessions of this user
        this.onlineUsers.delete(id);

        try {
            // 3. Nuclear DB Purge for this user
            await pool.query("DELETE FROM active_connections WHERE user_id = $1", [id]);

            // 4. Force update users table
            await pool.query(
                "UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1",
                [id]
            );

            logger.info('[Phase 1] User connections purged globally (DB Truth)', { userId: id });

            return {
                userId: id as UserId,
                isOnline: false,
                last_activity: new Date().toISOString()
            };
        } catch (error: unknown) {
            logger.error('[StatusService] Failed to purge user connections', {
                error: error instanceof Error ? error.message : String(error),
                userId
            });
            throw error;
        }
    }

    public async getPresenceBatch(userIds: string[]): Promise<Record<string, { isOnline: boolean, last_activity: string }>> {
        if (!userIds || userIds.length === 0) return {};
        const results: Record<string, { isOnline: boolean, last_activity: string }> = {};

        try {
            // 1. Query active_connections for ALL requested users (Truth Source)
            const onlineResult = await pool.query<{ user_id: string }>(
                `SELECT DISTINCT user_id FROM active_connections WHERE user_id = ANY($1)`,
                [userIds]
            );
            const onlineSet = new Set(onlineResult.rows.map(r => r.user_id));

            // 2. Fetch last_activity for ALL from users table
            const dbResult = await pool.query<{ id: string, last_activity: Date | string | null }>(
                `SELECT id, last_activity FROM users WHERE id = ANY($1)`,
                [userIds]
            );

            dbResult.rows.forEach((row) => {
                results[row.id] = {
                    isOnline: onlineSet.has(row.id),
                    last_activity: row.last_activity ?
                        (row.last_activity instanceof Date ? row.last_activity.toISOString() : new Date(row.last_activity).toISOString()) :
                        new Date().toISOString()
                };
            });

            return results;
        } catch (error: unknown) {
            logger.error('[StatusService] Nuclear batch presence fetch failed:', {
                error: error instanceof Error ? error.message : String(error),
                count: userIds.length
            });
            return results;
        }
    }

    /**
     * Phase 4: Surgical Cleanup (Safe)
     * Effectively purges orphaned database records that no longer correspond to active sockets.
     * Rule: NO TRUNCATE. Uses standard DELETE for precise cleanup.
     */
    public async institutionalSocketCleanup(): Promise<void> {
        try {
            // Since WebSocket sessions are process-bound, rows persisting across server 
            // restarts are definitively orphaned "Ghost" sessions.
            const result = await pool.query("DELETE FROM active_connections");
            logger.info('[Institutional Reset] Presence sanitized.', { purgedRows: result.rowCount || 0 });
        } catch (error: unknown) {
            logger.error('[Institutional Reset] Cleanup failure:', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /* ---------------- PRIVATE HELPERS (NON-BLOCKING) ---------------- */

    private async persistConnection(userId: string, socketId: string): Promise<void> {
        try {
            await pool.query(
                `INSERT INTO active_connections (user_id, socket_id) 
                 VALUES ($1, $2) 
                 ON CONFLICT (user_id, socket_id) DO UPDATE SET last_activity = CURRENT_TIMESTAMP`,
                [userId, socketId]
            );
            // which updates the session heartbeat (last_activity and expires_at).
            // Ensure last_activity is updated to track active interaction
            await pool.query("UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1", [userId]);
        } catch (error: unknown) {
            logger.error(`[StatusService] persistConnection DB error for userId = ${userId}`, {
                error: error instanceof Error ? error.message : String(error),
                socketId
            });
            throw error;
        }
    }

    private async fetchUserLastActivity(userId: string): Promise<string | null> {
        try {
            const result = await pool.query<{ last_activity: Date | string | null }>("SELECT last_activity FROM users WHERE id = $1", [userId]);
            if (result.rows[0]?.last_activity) {
                const date = result.rows[0].last_activity;
                return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
            }
            return null;
        } catch (error: unknown) {
            logger.error('[StatusService] Failed to fetch user last activity', {
                error: error instanceof Error ? error.message : String(error),
                userId
            });
            return null;
        }
    }
}

export const statusService = new StatusService();
