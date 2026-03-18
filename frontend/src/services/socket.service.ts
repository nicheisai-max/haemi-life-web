/// <reference types="vite/client" />
import io from 'socket.io-client';
import { getAccessToken } from './api';
import { logger } from '../utils/logger';

const SOCKET_URL = (import.meta.env?.VITE_API_URL || 'http://localhost:5000');

type InternalSocket = ReturnType<typeof io>;

interface SocketWithAuth extends InternalSocket {
    auth: { token: string };
}

// ─── Deterministic JWT Validation (Zero-Dependency) ──────────────────────────
const decodeJWT = (token: string | null) => {
    if (!token) return null;
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
};

const isTokenValid = (token: string | null): boolean => {
    const decoded = decodeJWT(token);
    if (!decoded?.exp) return false;
    const now = Math.floor(Date.now() / 1000);
    // Strict 30s buffer: Never attempt socket connection if token is expiring imminently
    return decoded.exp > now + 30;
};

class SocketService {
    private static instance: SocketService;
    private socket: SocketWithAuth | null = null;
    private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

    private constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('auth:token-refreshed', (e: Event) => {
                const customEvent = e as CustomEvent<{ token: string }>;
                const token = customEvent.detail.token;
                this.reconnectWithToken(token);
            });

            window.addEventListener('auth:unauthorized', () => {
                // Identity eviction requires deterministic destruction of active channels
                this.disconnect();
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
        
        // 🧱 SOCKET CONNECTION GATING: Intercept expired tokens pre-connection
        if (!authToken || !isTokenValid(authToken)) {
            this.disconnect();
            return;
        }

        const socketWithAuth = this.socket as SocketWithAuth | null;
        if (this.socket?.connected && socketWithAuth?.auth?.token === authToken) {
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
        }) as SocketWithAuth;

        this.socket.on('connect', () => {
            // Silent by design: ZERO-NOISE policy
        });

        this.socket.on('reconnect', (attemptNumber: number) => {
            // Restore event subscriptions without polluting terminal
            const callbacks = this.listeners.get('reconnect');
            if (callbacks) {
                callbacks.forEach(cb => cb(attemptNumber));
            }
        });

        this.socket.on('connect_error', (err: Error) => {
            // 🧠 ERROR CLASSIFICATION
            const msg = err.message?.toLowerCase() || '';
            const isAuthError = msg.includes('jwt') || msg.includes('auth') || msg.includes('unauthorized');
            
            if (isAuthError) {
                // A. AUTH EXPECTED (SILENT): Disconnect and await refresh lifecycle
                this.disconnect();
            } else {
                // B. SYSTEM ERRORS (LOG REQUIRED): Bubble up real network/connectivity failures
                logger.error('[SocketService] Connection failure', { reason: err.message });
            }
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
        if (!token || !isTokenValid(token)) {
            this.disconnect();
            return;
        }

        if (this.socket) {
            this.socket.auth = { token };
            if (this.socket.connected) {
                // 🔄 SAFE RECONNECT STRATEGY: Update pointer and force re-handshake
                this.socket.disconnect().connect();
            } else {
                this.socket.connect();
            }
        } else {
            this.connect(token);
        }
    }

    public on<T extends unknown[]>(event: string, callback: (...args: T) => void) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)?.add(callback as (...args: unknown[]) => void);
        this.socket?.on(event, callback as (...args: unknown[]) => void);
    }

    public off<T extends unknown[]>(event: string, callback: (...args: T) => void) {
        this.listeners.get(event)?.delete(callback as (...args: unknown[]) => void);
        this.socket?.off(event, callback as (...args: unknown[]) => void);
    }

    public emit(event: string, data: unknown) {
        if (!this.socket?.connected) {
            // Silenced missing connection warning to adhere to zero-noise output policy
            return;
        }
        this.socket?.emit(event, data);
    }

    public getSocket(): SocketWithAuth | null {
        return this.socket as SocketWithAuth | null;
    }
}

export const socketService = SocketService.getInstance();

