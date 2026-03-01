import { Request, Response } from 'express';
import { pool } from '../config/db';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';

export const getNotifications = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return sendError(res, 401, 'Unauthorized');

        const result = await pool.query(
            'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );

        return sendResponse(res, 200, true, 'Notifications fetched successfully', result.rows);
    } catch (error: unknown) {
        logger.error('Error fetching notifications:', { error: (error as Error).message, userId: req.user?.id });
        return sendError(res, 500, 'Failed to fetch notifications');
    }
};

export const markAsRead = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return sendError(res, 401, 'Unauthorized');
        const { notificationId } = req.params;

        await pool.query(
            'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
            [notificationId, userId]
        );

        return sendResponse(res, 200, true, 'Notification marked as read');
    } catch (error: unknown) {
        logger.error('Error marking notification as read:', { error: (error as Error).message, notificationId: req.params.notificationId });
        return sendError(res, 500, 'Failed to update notification');
    }
};

export const markAllAsRead = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return sendError(res, 401, 'Unauthorized');

        await pool.query(
            'UPDATE notifications SET is_read = true WHERE user_id = $1',
            [userId]
        );

        return sendResponse(res, 200, true, 'All notifications marked as read');
    } catch (error: unknown) {
        logger.error('Error marking all notifications as read:', { error: (error as Error).message, userId: req.user?.id });
        return sendError(res, 500, 'Failed to update all notifications');
    }
};
