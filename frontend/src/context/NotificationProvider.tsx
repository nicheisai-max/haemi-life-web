import React, { useEffect, useState, useCallback } from 'react';
import { notificationService, type Notification } from '../services/notification.service';
import { useAuth } from '../hooks/useAuth';
import { socketService } from '../services/socket.service';
import { NotificationContext } from './NotificationContext';

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
            setUnreadCount(data.filter(n => !n.is_read).length);
        } catch {
            // Enterprise Fix: Silent fail for background sync
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

            socketService.on('notification:new', handleNewNotification);
            return () => {
                socketService.off('notification:new', handleNewNotification);
            };
        }
    }, [isAuthenticated, fetchNotifications]);

    const markAsRead = async (id: string) => {
        try {
            await notificationService.markAsRead(id);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, is_read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch {
            // Enterprise Fix: Silent fail
        }
    };

    const markAllAsRead = async () => {
        try {
            await notificationService.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch {
            // Enterprise Fix: Silent fail
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
