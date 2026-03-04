import { pool } from '../config/db';
import { io } from '../app';

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
        const result = await pool.query(
            `INSERT INTO notifications (user_id, title, description, type)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [userId, title, description, type]
        );
        const notification = result.rows[0];

        // Emit to the user's personal room — user joins `user:<id>` on socket connect
        if (io) {
            io.to(`user:${userId}`).emit('notification:new', notification);
        }

        return notification;
    },
};
