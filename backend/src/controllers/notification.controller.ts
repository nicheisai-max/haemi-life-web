import { Request, Response } from 'express';
import { pool } from '../config/db';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { socketIO } from '../app';

interface NotificationRow {
    id: string;
    user_id: string;
    type: 'success' | 'warning' | 'info' | 'error';
    title: string;
    description: string;
    is_read: boolean;
    message_id: string | null;
    conversation_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: Date;
    received_at: Date | null;
}

/**
 * Fetch last 50 notifications for the user (Google-grade pruning)
 */
export const getNotifications = async (req: Request, res: Response) => {
    const userId = req.user?.id;

    try {
        if (!userId) return sendError(res, 401, 'Unauthorized');

        const result = await pool.query<NotificationRow>(
            'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
            [userId]
        );

        const mapped = result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            type: row.type,
            title: row.title,
            description: row.description,
            isRead: row.is_read,
            messageId: row.message_id,
            conversationId: row.conversation_id,
            metadata: row.metadata,
            createdAt: row.created_at,
            receivedAt: row.received_at
        }));

        return sendResponse(res, 200, true, 'Notifications fetched successfully', mapped);
    } catch (error: unknown) {
        logger.error('Error fetching notifications:', { 
            error: error instanceof Error ? error.message : String(error), 
            userId 
        });
        return sendError(res, 500, 'Failed to fetch notifications');
    }
};

/**
 * Atomic mark as read with global cross-tab sync
 */
export const markAsRead = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { notificationId } = req.params;

    try {
        if (!userId) return sendError(res, 401, 'Unauthorized');

        await pool.query(
            'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
            [notificationId, userId]
        );

        // Global Cross-Tab Sync via The Governor
        if (socketIO) {
            socketIO.to(`user:${userId}`).emit('notificationRead', { id: String(notificationId) });
        }

        return sendResponse(res, 200, true, 'Notification marked as read');
    } catch (error: unknown) {
        logger.error('Error marking notification as read:', { 
            error: error instanceof Error ? error.message : String(error), 
            notificationId,
            userId
        });
        return sendError(res, 500, 'Failed to update notification');
    }
};

/**
 * Institutional bulk acknowledge with global cross-tab sync
 */
export const markAllAsRead = async (req: Request, res: Response) => {
    const userId = req.user?.id;

    try {
        if (!userId) return sendError(res, 401, 'Unauthorized');

        await pool.query(
            'UPDATE notifications SET is_read = true WHERE user_id = $1',
            [userId]
        );

        // Global Cross-Tab Sync via The Governor
        if (socketIO) {
            socketIO.to(`user:${userId}`).emit('notificationReadAll');
        }

        return sendResponse(res, 200, true, 'All notifications marked as read', { userId });
    } catch (error: unknown) {
        logger.error('Error marking all notifications as read:', { 
            error: error instanceof Error ? error.message : String(error), 
            userId 
        });
        return sendError(res, 500, 'Failed to update all notifications');
    }
};
