import React, { useEffect, useState, useCallback, useRef } from 'react';
import { notificationService, type Notification } from '../services/notification.service';
import { useAuth } from '../hooks/use-auth';
import { socketService } from '../services/socket.service';
import { logger } from '../utils/logger';
import { NotificationContext } from './notification-context';

/** Institutional Circular Buffer: Max 50 notifications in RAM (Google/Meta Grade) */
const MAX_NOTIFICATIONS = 50;

const pruneToMax = (notifications: Notification[]): Notification[] => {
    if (notifications.length <= MAX_NOTIFICATIONS) return notifications;
    return notifications.slice(0, MAX_NOTIFICATIONS);
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // Ref to prevent stale closures in socket callbacks
    const notificationsRef = useRef<Notification[]>([]);
    notificationsRef.current = notifications;

    const fetchNotifications = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            setLoading(true);
            const data = await notificationService.getNotifications();
            const pruned = pruneToMax(data);
            setNotifications(pruned);
            setUnreadCount(pruned.filter(n => !n.isRead).length);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Phase 4: Silent suppression for expected session-termination errors.
            // 'No active session' / 'FatalAuthError' are expected during logout transition.
            // We must NOT log these as errors to keep the console clean for the Investor Demo.
            const isExpectedSessionError = errorMessage.includes('No active session') ||
                errorMessage.includes('Session terminated') ||
                errorMessage.includes('FatalAuthError');

            if (isExpectedSessionError) {
                logger.info('[NotificationProvider] Fetch suppressed: session not active (expected during logout).');
            } else {
                logger.error('[NotificationProvider] Failed to fetch notifications:', errorMessage);
            }
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    // Phase 4: Atomic state purge on session exit.
    // When isAuthenticated drops to false (logout/cross-tab teardown),
    // we must immediately clear notification state to prevent stale data
    // from being visible if the login page is briefly rendered before the
    // Phase 2 hard redirect completes.
    useEffect(() => {
        if (!isAuthenticated) {
            logger.info('[NotificationProvider] Session exited. Purging notification state.');
            setNotifications([]);
            setUnreadCount(0);
            setLoading(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) return;

        fetchNotifications();

        /* ---------- Push: New notification from server ---------- */
        const handleNewNotification = (notif: Notification) => {
            setNotifications(prev => {
                const updated = [notif, ...prev.filter(n => n.id !== notif.id)];
                return pruneToMax(updated);
            });
            setUnreadCount(prev => prev + 1);
        };

        /* ---------- Cross-Tab Sync: Single read ---------- */
        const handleNotificationRead = ({ id }: { id: string }) => {
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, isRead: true } : n)
            );
            setUnreadCount(prev => {
                const target = notificationsRef.current.find(n => n.id === id);
                if (target && !target.isRead) return Math.max(0, prev - 1);
                return prev;
            });
        };

        /* ---------- Cross-Tab Sync: Mark all read ---------- */
        const handleNotificationReadAll = () => {
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        };

        /* ---------- Atomic Recall: Server withdraws notification for deleted message ---------- */
        const handleNotificationDelete = ({ id }: { id: string; messageId?: string }) => {
            setNotifications(prev => {
                const target = prev.find(n => n.id === id);
                const next = prev.filter(n => n.id !== id);
                if (target && !target.isRead) {
                    setUnreadCount(count => Math.max(0, count - 1));
                }
                return next;
            });
        };

        /* ---------- Legacy: Remove notifications for deleted messages ---------- */
        const handleMessageDeleted = ({ messageId }: { messageId: string }) => {
            setNotifications(prev => {
                const toDelete = prev.filter(n => n.messageId === messageId);
                if (toDelete.length === 0) return prev;
                const unreadDeleted = toDelete.filter(n => !n.isRead).length;
                if (unreadDeleted > 0) {
                    setUnreadCount(count => Math.max(0, count - unreadDeleted));
                }
                return prev.filter(n => n.messageId !== messageId);
            });
        };

        socketService.on('notificationNew', handleNewNotification);
        socketService.on('notificationRead', handleNotificationRead);
        socketService.on('notificationReadAll', handleNotificationReadAll);
        socketService.on('notificationDelete', handleNotificationDelete);
        socketService.on('messageDeleted', handleMessageDeleted);

        return () => {
            socketService.off('notificationNew', handleNewNotification);
            socketService.off('notificationRead', handleNotificationRead);
            socketService.off('notificationReadAll', handleNotificationReadAll);
            socketService.off('notificationDelete', handleNotificationDelete);
            socketService.off('messageDeleted', handleMessageDeleted);
        };
    }, [isAuthenticated, fetchNotifications]);

    const markAsRead = async (id: string) => {
        try {
            // Optimistic update
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, isRead: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
            await notificationService.markAsRead(id);
            // Backend will echo 'notificationRead' to other tabs via socket
        } catch (error: unknown) {
            logger.error('[NotificationProvider] Mark as read failed:', error instanceof Error ? error.message : String(error));
            // Rollback on failure
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, isRead: false } : n)
            );
            setUnreadCount(prev => prev + 1);
        }
    };

    const markAllAsRead = async () => {
        try {
            // Optimistic update
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
            await notificationService.markAllAsRead();
            // Backend will echo 'notificationReadAll' to other tabs via socket
        } catch (error: unknown) {
            logger.error('[NotificationProvider] Mark all as read failed:', error instanceof Error ? error.message : String(error));
            // Rollback
            await fetchNotifications();
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
