import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { notificationService, type Notification } from '../services/notification.service';
import { getAccessToken } from '../services/api';
import { useAuth } from './AuthContext';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const socketRef = useRef<ReturnType<typeof io> | null>(null);

    useEffect(() => {
        if (!user?.id) return;

        let mounted = true;

        const fetchAll = async () => {
            try {
                const data = await notificationService.getNotifications();
                if (mounted) setNotifications(data);
            } catch (err) {
                console.error('[NotificationContext] Failed to fetch:', err);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchAll();

        const token = getAccessToken();
        const socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });
        socketRef.current = socket;

        socket.on('new_notification', (notification: Notification) => {
            if (mounted) setNotifications(prev => [notification, ...prev]);
        });

        // FIX 4: Socket Auth Revalidation
        const handleTokenRefreshed = (e: any) => {
            const newToken = e.detail.token;
            if (socket && newToken) {
                // @ts-ignore
                socket.auth.token = newToken;
                if (!socket.connected) socket.connect();
            }
        };

        socket.on('connect_error', (err: Error) => {
            // If socket 401s, it might need a refresh. 
            // api.ts handles the actual refresh, we just wait for the event.
            if (err.message === 'Authentication required' || err.message === 'Invalid authentication token') {
                console.warn('[NotificationContext] Socket Auth Failed. Waiting for refresh...');
            }
        });

        window.addEventListener('auth:token-refreshed', handleTokenRefreshed);

        return () => {
            mounted = false;
            window.removeEventListener('auth:token-refreshed', handleTokenRefreshed);
            socket.disconnect();
            socketRef.current = null;
        };
    }, [user?.id]);

    const markAsRead = useCallback(async (id: string) => {
        try {
            await notificationService.markAsRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (err) {
            console.error('[NotificationContext] Failed to mark as read:', err);
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        try {
            await notificationService.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (err) {
            console.error('[NotificationContext] Failed to mark all as read:', err);
        }
    }, []);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, loading, markAsRead, markAllAsRead }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        return {
            notifications: [], unreadCount: 0, loading: false,
            markAsRead: async () => { }, markAllAsRead: async () => { }
        };
    }
    return context;
};
