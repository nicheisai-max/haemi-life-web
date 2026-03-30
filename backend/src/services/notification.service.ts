import { pool } from '../config/db';
import { socketIO as io } from '../app';
import { HaemiNotification } from '../types/socket.types';
import { logger } from '../utils/logger';

export type NotificationType = 'success' | 'info' | 'warning' | 'error';

/**
 * Shared notification helper — inserts a row into the notifications table
 * and immediately emits it to the target user's personal Socket.IO room.
 * Use this in ANY controller that needs to notify a user in real-time.
 */
export const notificationService = {
    create: async (
        userId: string,
        title: string,
        description: string,
        type: NotificationType
    ) => {
        try {
            const result = await pool.query<{
                id: number;
                user_id: string;
                title: string;
                description: string;
                type: NotificationType;
                is_read: boolean;
                created_at: Date | string;
            }>(
                `INSERT INTO notifications (user_id, title, description, type)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [userId, title, description, type]
            );
            const raw = result.rows[0];
            const notification: HaemiNotification = {
                id: String(raw.id),
                userId: raw.user_id,
                title: raw.title,
                description: raw.description,
                type: raw.type,
                isRead: raw.is_read,
                createdAt: raw.created_at instanceof Date ? raw.created_at.toISOString() : String(raw.created_at)
            };

            // Emit to the user's personal room — user joins `user:<id>` on socket connect
            if (io) {
                io.to(`user:${userId}`).emit('notification:new', notification);
            } else {
                logger.warn('[NotificationService] SocketIO not initialized, emission skipped', { userId, title });
            }

            return notification;
        } catch (error: unknown) {
            logger.error('[NotificationService] Failed to create notification', {
                error: error instanceof Error ? error.message : String(error),
                userId,
                title
            });
            throw error;
        }
    },
};
