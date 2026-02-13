import { Response } from 'express';
import { pool } from '../config/db';

export const getNotifications = async (req: any, res: Response) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const markAsRead = async (req: any, res: Response) => {
    try {
        const userId = req.user.id;
        const { notificationId } = req.params;

        await pool.query(
            'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
            [notificationId, userId]
        );

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const markAllAsRead = async (req: any, res: Response) => {
    try {
        const userId = req.user.id;

        await pool.query(
            'UPDATE notifications SET is_read = true WHERE user_id = $1',
            [userId]
        );

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
