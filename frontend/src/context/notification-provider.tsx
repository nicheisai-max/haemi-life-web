import React, { useEffect, useState, useCallback } from 'react';
import { notificationService, type Notification } from '../services/notification.service';
import { useAuth } from '../hooks/use-auth';
import { socketService } from '../services/socket.service';
import { logger } from '../utils/logger';
import { NotificationContext } from './notification-context';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            setLoading(true);
            const data = await notificationService.getNotifications();
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.isRead).length);
        } catch (error: unknown) {
            logger.error('[NotificationProvider] Failed to fetch notifications:', error instanceof Error ? error.message : String(error));
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchNotifications();

            // Sockets integration - ZERO UI DAMAGE
            const handleNewNotification = (notif: Notification) => {
                setNotifications(prev => [notif, ...prev]);
                setUnreadCount(prev => prev + 1);
            };

            const handleMessageDeleted = ({ messageId }: { messageId: string }) => {
                // P5 FIX: Synchronize notification list with deleted messages
                setNotifications(prev => {
                    const toDelete = prev.filter(n => n.messageId === messageId || n.id === messageId);
                    if (toDelete.length === 0) return prev;
                    
                    const newNotifs = prev.filter(n => n.messageId !== messageId && n.id !== messageId);
                    const unreadDeleted = toDelete.filter(n => !n.isRead).length;
                    setUnreadCount(count => Math.max(0, count - unreadDeleted));
                    return newNotifs;
                });
            };

            socketService.on('notification:new', handleNewNotification);
            socketService.on('messageDeleted', handleMessageDeleted);
            return () => {
                socketService.off('notification:new', handleNewNotification);
                socketService.off('messageDeleted', handleMessageDeleted);
            };
        }
    }, [isAuthenticated, fetchNotifications]);

    const markAsRead = async (id: string) => {
        try {
            await notificationService.markAsRead(id);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, isRead: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error: unknown) {
            logger.error('[NotificationProvider] Mark as read failed:', error instanceof Error ? error.message : String(error));
        }
    };

    const markAllAsRead = async () => {
        try {
            await notificationService.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (error: unknown) {
            logger.error('[NotificationProvider] Mark all as read failed:', error instanceof Error ? error.message : String(error));
        }
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            loading,
            markAsRead,
            markAllAsRead
        }}>
            {children}
        </NotificationContext.Provider>
    );
};
