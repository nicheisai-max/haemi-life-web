import api from './api';

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    description: string;
    type: 'success' | 'warning' | 'info' | 'error';
    is_read: boolean;
    created_at: string;
}

export const notificationService = {
    getNotifications: async (): Promise<Notification[]> => {
        const response = await api.get<Notification[]>('/notifications');
        return response.data;
    },

    markAsRead: async (notificationId: string): Promise<void> => {
        await api.patch(`/notifications/${notificationId}/read`);
    },

    markAllAsRead: async (): Promise<void> => {
        await api.post('/notifications/read-all');
    },
};
