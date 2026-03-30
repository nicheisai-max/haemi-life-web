import { Request, Response } from 'express';
import { pool } from '../config/db';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';

interface NotificationRow {
    id: string;
    user_id: string;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    data: Record<string, unknown> | null;
    created_at: Date;
}

export const getNotifications = async (req: Request, res: Response) => {
    const userId = req.user?.id;

    try {
        if (!userId) return sendError(res, 401, 'Unauthorized');

        const result = await pool.query<NotificationRow>(
            'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );

        const mapped = result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            type: row.type,
            title: row.title,
            message: row.message,
            isRead: row.is_read,
            data: row.data,
            createdAt: row.created_at
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


export const markAsRead = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { notificationId } = req.params;

    try {
        if (!userId) return sendError(res, 401, 'Unauthorized');

        await pool.query(
            'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
            [notificationId, userId]
        );

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

export const markAllAsRead = async (req: Request, res: Response) => {
    const userId = req.user?.id;

    try {
        if (!userId) return sendError(res, 401, 'Unauthorized');

        await pool.query(
            'UPDATE notifications SET is_read = true WHERE user_id = $1',
            [userId]
        );

        return sendResponse(res, 200, true, 'All notifications marked as read', { userId });
    } catch (error: unknown) {
        logger.error('Error marking all notifications as read:', { 
            error: error instanceof Error ? error.message : String(error), 
            userId 
        });
        return sendError(res, 500, 'Failed to update all notifications');
    }
};
