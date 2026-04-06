import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';
import { logger } from '../utils/logger';
import type { SocketConnectionState } from '../types/socket.types';
import { safeParseJSON, isSocketErrorPayload } from '../utils/type-guards';
import type { Notification as HaemiNotification } from './notification.service';
import type { Message } from '../hooks/use-chat';

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

/* ---------------- SIGNAL ---------------- */

interface SignalData {
    type?: 'offer' | 'answer' | 'pranswer' | 'rollback';
    sdp?: string;
    candidate?: Record<string, string | number | boolean>;
}

/* ---------------- EVENTS ---------------- */

export interface MessageReadEvent {
    messageId: string;
    userId: string;
}

export interface ServerToClientEvents {
    connect: () => void;
    disconnect: (reason: string) => void;
    connect_error: (err: Error) => void;
    reconnect_attempt: (attempt: number) => void;
    reconnect_failed: () => void;
    reconnect: () => void;
    participantJoined: (participantId: string) => void;
    callMade: (data: { offer: SignalData; socket: string }) => void;
    answerMade: (data: { answer: SignalData; socket: string }) => void;
    iceCandidate: (data: { candidate: SignalData; socket: string }) => void;
    messageReaction: (data: {
        messageId: string;
        userId: string;
        reactionType: string;
        action: 'added' | 'removed';
    }) => void | Promise<void>;
    messageDeleted: (data: { messageId: string; conversationId: string }) => void | Promise<void>;
    typingStarted: (data: { userId: string; conversationId: string; name: string }) => void | Promise<void>;
    typingStopped: (data: { userId: string; conversationId: string; name: string }) => void | Promise<void>;
    messageDelivered: (data: { conversationId: string; messageIds: string[] }) => void | Promise<void>;
    messageRead: (data: MessageReadEvent) => void | Promise<void>;
    messageReceived: (message: Message) => void | Promise<void>;
    notificationNew: (notification: HaemiNotification) => void | Promise<void>;
    notificationRead: (data: { id: string }) => void | Promise<void>;
    notificationDelete: (data: { id: string; messageId?: string }) => void | Promise<void>;
    notificationReadAll: () => void | Promise<void>;
    userStatus: (data: { userId: string; isOnline: boolean; lastActivity: string }) => void | Promise<void>;
    ackDelivery: (data: { conversationId: string; messageId: string }) => void | Promise<void>;
    localMessageDeleted: (data: { messageId: string }) => void | Promise<void>;
    adminMirrorEvent: (payload: { event: string; data: unknown; timestamp: string }) => void | Promise<void>;
}

export interface ClientToServerEvents {
    joinConsultation: (appointmentId: string) => void;
    callUser: (data: { offer: SignalData; to: string }) => void;
    makeAnswer: (data: { answer: SignalData; to: string }) => void;
    iceCandidate: (data: { candidate: SignalData; to: string }) => void;
    ackDelivery: (data: { conversationId: string; messageId: string }) => void;
    joinConversation: (conversationId: string) => void;
    messageRead: (data: MessageReadEvent) => void;
    typingStarted: (data: { conversationId: string; name: string }) => void;
    typingStopped: (data: { conversationId: string; name: string }) => void;
}

/* ---------------- TYPES ---------------- */

type SocketInstance = Socket<ServerToClientEvents, ClientToServerEvents>;

type ListenerMap = Map<
    keyof ServerToClientEvents,
    Set<ServerToClientEvents[keyof ServerToClientEvents]>
>;

/* ---------------- SERVICE ---------------- */

class SocketService {
    private socket: SocketInstance | null = null;
    private listeners: ListenerMap = new Map();
    private state: SocketConnectionState = 'IDLE';

    private setState(state: SocketConnectionState) {
        if (this.state === state) return;
        this.state = state;
        logger.info(`Socket → ${state}`);
    }

    private getSet(event: keyof ServerToClientEvents) {
        let set = this.listeners.get(event);
        if (!set) {
            set = new Set();
            this.listeners.set(event, set);
        }
        return set;
    }

    private attachAll(socket: SocketInstance) {
        this.listeners.forEach((set, event) => {
            set.forEach((cb) => {
                // Type-safe attachment using the specific event key
                // Convert to unknown first to allow cross-type casting without 'any'
                socket.on(
                    event as keyof ServerToClientEvents, 
                    cb as never
                ); 
            });
        });
    }

    async connect(tokenOverride?: string) {
        const token = tokenOverride || getAccessToken();
        if (!token) return;

        try {
            const socket = io(SOCKET_URL, {
                auth: { token },
                withCredentials: true,
                transports: ['polling', 'websocket'], // P0: Institutional Handshake (Polling → WS Upgrade)
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                timeout: 20000,
            });

            this.socket?.disconnect();
            this.socket = socket;

            this.attachAll(socket);

            socket.on('connect', () => this.setState('CONNECTED'));

            socket.on('disconnect', (reason) => {
                this.setState(
                    reason === 'io server disconnect'
                        ? 'CLOSED'
                        : 'TRANSPORT_DISCONNECTED'
                );
            });

            socket.on('connect_error', (err) => {
                const parsed = safeParseJSON(err.message, isSocketErrorPayload);

                if (!parsed) {
                    this.setState('HANDSHAKE_FAILED');
                    return;
                }

                if (parsed.code === 'AUTH_EXPIRED') {
                    this.setState('FAILED');
                    this.disconnect();
                }
            });

        } catch (error: unknown) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error(err.message);
            this.setState('FAILED');
        }
    }

    on<K extends keyof ServerToClientEvents>(
        event: K,
        cb: ServerToClientEvents[K]
    ) {
        const set = this.getSet(event);
        
        // P0: Idempotency Guard. Prevent multiple socket.on registrations for same callback
        if (set.has(cb)) {
            logger.warn(`[SocketService] Duplicate registration skipped for event: ${event}`);
            return;
        }

        set.add(cb);

        if (this.socket) {
            this.socket.on(
                event as keyof ServerToClientEvents, 
                cb as never
            );
        }
    }

    off<K extends keyof ServerToClientEvents>(
        event: K,
        cb: ServerToClientEvents[K]
    ) {
        const set = this.listeners.get(event);
        if (!set) return;

        set.delete(cb);

        if (this.socket) {
            this.socket.off(event as Parameters<SocketInstance['off']>[0], cb as never);
        }
    }

    emit<K extends keyof ClientToServerEvents>(
        event: K,
        ...args: Parameters<ClientToServerEvents[K]>
    ) {
        if (!this.socket || this.state !== 'CONNECTED') return;
        this.socket.emit(event, ...args);
    }

    disconnect() {
        this.socket?.disconnect();
        this.socket = null;
        this.setState('CLOSED');
    }
}

/* ---------------- SINGLETON ---------------- */

declare global {
    interface Window {
        __SOCKET__?: SocketService;
    }
}

export const socketService =
    typeof window !== 'undefined'
        ? (window.__SOCKET__ ??= new SocketService())
        : new SocketService();