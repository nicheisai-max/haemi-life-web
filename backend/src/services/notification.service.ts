import { pool } from '../config/db';
import { socketIO as io } from '../app';
import { HaemiNotification } from '../types/socket.types';
import { logger } from '../utils/logger';
import { UserId, MessageId, ConversationId } from '../types/chat.types';

export type NotificationType = 'success' | 'info' | 'warning' | 'error';

/**
 * Shared notification helper — inserts a row into the notifications table
 * and immediately emits it to the target user's personal Socket.IO room.
 * Use this in ANY controller that needs to notify a user in real-time.
 */
export interface NotificationCreateOptions {
    messageId?: string;
    conversationId?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Shared notification helper — inserts a row into the notifications table
 * and immediately emits it to the target user's personal Socket.IO room.
 */
export const notificationService = {
    create: async (
        userId: string,
        title: string,
        description: string,
        type: NotificationType,
        options: NotificationCreateOptions = {}
    ) => {
        try {
            const { messageId, conversationId, metadata } = options;

            const result = await pool.query<{
                id: string;
                user_id: string;
                title: string;
                description: string;
                type: NotificationType;
                is_read: boolean;
                message_id: string | null;
                conversation_id: string | null;
                metadata: Record<string, unknown> | null;
                created_at: Date | string;
                received_at: Date | string | null;
            }>(
                `INSERT INTO notifications (
                    user_id, title, description, type, 
                    message_id, conversation_id, metadata, 
                    created_at, received_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, NOW()) 
                RETURNING *`,
                [userId, title, description, type, messageId || null, conversationId || null, metadata || {}]
            );

            const raw = result.rows[0];
            const notification: HaemiNotification = {
                id: raw.id,
                userId: raw.user_id as UserId,
                title: raw.title,
                description: raw.description,
                type: raw.type,
                isRead: raw.is_read,
                messageId: (raw.message_id as MessageId) || undefined,
                conversationId: (raw.conversation_id as ConversationId) || undefined,
                metadata: raw.metadata || undefined,
                createdAt: raw.created_at instanceof Date ? raw.created_at.toISOString() : String(raw.created_at),
                receivedAt: raw.received_at instanceof Date ? raw.received_at.toISOString() : (raw.received_at ? String(raw.received_at) : undefined)
            };

            // Emit to direct user room
            if (io) {
                io.to(`user:${userId}`).emit('notificationNew', notification);
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

    /**
     * Institutional Recall: Withdraw all notifications tied to a retracted message.
     */
    recall: async (messageId: string) => {
        try {
            // 1. Identify affected users before deletion for targeted emission
            const result = await pool.query<{ user_id: string; id: string }>(
                'SELECT user_id, id FROM notifications WHERE message_id = $1',
                [messageId]
            );

            if (result.rowCount === 0) return;

            const affected = result.rows;

            // 2. Atomic Removal from Database
            await pool.query('DELETE FROM notifications WHERE message_id = $1', [messageId]);

            // 3. Global Tab Cleanup via The Governor
            const socketServer = io;
            if (socketServer) {
                affected.forEach(row => {
                    socketServer.to(`user:${row.user_id}`).emit('notificationDelete', { 
                        id: row.id,
                        messageId: messageId as MessageId
                    });
                });
            }

            logger.info(`[NotificationService] Recalled ${affected.length} notifications for messageId: ${messageId}`);
        } catch (error: unknown) {
            logger.error('[NotificationService] Failed to recall notification', {
                error: error instanceof Error ? error.message : String(error),
                messageId
            });
        }
    },

    sendAppointmentReminder: async (
        userId: string,
        appointmentId: string,
        patientId: string,
        doctorId: string,
        scheduledAt: string
    ) => {
        try {
            return await notificationService.create(
                userId,
                'Appointment Reminder',
                `Reminder: You have an upcoming consultation (Ref: ${appointmentId}) scheduled for ${scheduledAt}.`,
                'info',
                { metadata: { appointmentId, patientId, doctorId } }
            );
        } catch (error: unknown) {
            logger.error('[NotificationService] Failed to send appointment reminder', {
                error: error instanceof Error ? error.message : String(error),
                userId,
                appointmentId
            });
            throw error;
        }
    }
};
