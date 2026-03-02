/// <reference types="vite/client" />
import io from 'socket.io-client';
type Socket = ReturnType<typeof io>;
import { getAccessToken } from './api';

const SOCKET_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:5000');

class SocketService {
    private static instance: SocketService;
    private socket: Socket | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

    private constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('auth:token-refreshed', (e: Event) => {
                const customEvent = e as CustomEvent<{ token: string }>;
                const token = customEvent.detail.token;
                this.reconnectWithToken(token);
            });
        }
    }

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    public connect(token?: string) {
        const authToken = token || getAccessToken();
        if (!authToken) return;

        const socketWithAuth = this.socket as unknown as { auth?: { token: string }; connected: boolean };
        if (this.socket?.connected && socketWithAuth.auth?.token === authToken) {
            return;
        }

        if (this.socket) {
            this.socket.disconnect();
        }

        this.socket = io(SOCKET_URL, {
            auth: { token: authToken },
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5
        });

        this.socket.on('connect', () => {
            console.log('[SocketService] Connected');
        });

        this.socket.on('connect_error', (err: Error) => {
            console.error('[SocketService] Connection error:', err.message);
        });

        // Re-attach all global listeners
        this.listeners.forEach((callbacks, event) => {
            callbacks.forEach(cb => this.socket?.on(event, cb as (...args: unknown[]) => void));
        });
    }

    public disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    public reconnectWithToken(token: string) {
        if (this.socket) {
            (this.socket as unknown as { auth: { token: string } }).auth = { token };
            this.socket.disconnect().connect();
            console.log('[SocketService] Re-handshake performed with new token');
        } else {
            this.connect(token);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public on(event: string, callback: (...args: any[]) => void) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)?.add(callback);
        this.socket?.on(event, callback as (...args: unknown[]) => void);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public off(event: string, callback: (...args: any[]) => void) {
        this.listeners.get(event)?.delete(callback);
        this.socket?.off(event, callback as (...args: unknown[]) => void);
    }

    public emit(event: string, data: unknown) {
        if (!this.socket?.connected) {
            console.warn(`[SocketService] Attempted to emit ${event} while disconnected`);
        }
        this.socket?.emit(event, data);
    }

    public getSocket(): Socket | null {
        return this.socket;
    }
}

export const socketService = SocketService.getInstance();
