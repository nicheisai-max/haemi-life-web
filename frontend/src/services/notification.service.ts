import api, { normalizeResponse } from './api';
import type { ApiResponse } from '../types/auth.types';

export interface Notification {
    id: string;
    userId: string;
    title: string;
    description: string;
    type: 'success' | 'warning' | 'info' | 'error';
    isRead: boolean;
    createdAt: string;
    messageId?: string; // Phase 5 Link: Ensure notifications can be tracked to specific messages
    conversationId?: string;
    metadata?: Record<string, unknown>;
}

export const notificationService = {
    getNotifications: async (): Promise<Notification[]> => {
        const response = await api.get<ApiResponse<Notification[]>>('/notifications');
        return normalizeResponse(response);
    },

    markAsRead: async (notificationId: string): Promise<void> => {
        const response = await api.patch<ApiResponse<void>>(`/notifications/${notificationId}/read`);
        normalizeResponse(response);
    },

    markAllAsRead: async (): Promise<void> => {
        const response = await api.post<ApiResponse<void>>('/notifications/read-all');
        normalizeResponse(response);
    },
};
