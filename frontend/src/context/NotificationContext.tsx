import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { notificationService, type Notification } from '../services/notification.service';
import { getAccessToken } from '../services/api';
import { useAuth } from './AuthContext';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ─── Context Shape ───────────────────────────────────────────────────────────
interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────
// IMPORTANT: This provider is only rendered when authStatus === 'authenticated'
// (enforced by AuthGatedNotifications in App.tsx). Therefore getAccessToken()
// is guaranteed to return a non-null token here — no race condition possible.
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const socketRef = useRef<ReturnType<typeof io> | null>(null);

    useEffect(() => {
        if (!user?.id) return;

        let mounted = true;

        // ── 1. Fetch all historic notifications from DB ───────────────────
        const fetchAll = async () => {
            try {
                const data = await notificationService.getNotifications();
                if (mounted) setNotifications(data);
            } catch (err) {
                console.error('[NotificationContext] Failed to fetch notifications:', err);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchAll();

        // ── 2. Open a single Socket.IO connection ─────────────────────────
        // Token is guaranteed to be in memory at this point (provider is
        // auth-gated), so there is no race condition here.
        const token = getAccessToken();
        const socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket'],
            reconnectionAttempts: 5,
        });
        socketRef.current = socket;

        // Prepend new real-time notifications instantly
        socket.on('new_notification', (notification: Notification) => {
            if (mounted) {
                setNotifications(prev => [notification, ...prev]);
            }
        });

        socket.on('connect_error', (err: Error) => {
            console.warn('[NotificationContext] Socket connect error:', err.message);
        });

        // ── 3. Cleanup on unmount (e.g. logout) ───────────────────────────
        return () => {
            mounted = false;
            socket.disconnect();
            socketRef.current = null;
        };
    }, [user?.id]); // Fires exactly once per authenticated user — never on the raw token

    // ─── Actions ─────────────────────────────────────────────────────────────
    const markAsRead = useCallback(async (id: string) => {
        try {
            await notificationService.markAsRead(id);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, is_read: true } : n)
            );
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

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        console.warn('[NotificationContext] useNotifications outside provider. Returning safe stub to prevent crash loop.');
        return {
            notifications: [],
            unreadCount: 0,
            loading: false,
            markAsRead: async () => { },
            markAllAsRead: async () => { }
        };
    }
    return context;
};
