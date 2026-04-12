import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';
import { logger } from '../utils/logger';
import type { SocketConnectionState } from '../types/socket.types';
import { safeParseJSON, isSocketErrorPayload } from '../utils/type-guards';
import type { Notification as HaemiNotification } from './notification.service';
import type { Message, UserId, MessageId, ConversationId } from '../types/chat';

const RAW_SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';
// P0: Institutional Determinism - Replace 'localhost' with '127.0.0.1' to bypass IPv6 resolution drift
const SOCKET_URL = RAW_SOCKET_URL.replace('localhost', '127.0.0.1');

/* ---------------- SIGNAL ---------------- */

interface SignalData {
    type?: 'offer' | 'answer' | 'pranswer' | 'rollback';
    sdp?: string;
    candidate?: Record<string, string | number | boolean>;
}

/* ---------------- EVENTS ---------------- */

export interface MessageReadEvent {
    conversationId: ConversationId;
    messageIds: MessageId[];
    userId: UserId;
}

export interface ServerToClientEvents {
    connect: () => void;
    disconnect: (reason: string) => void;
    connect_error: (err: Error) => void;
    reconnect_attempt: (attempt: number) => void;
    reconnect_failed: () => void;
    reconnect: () => void;
    participantJoined: (participantId: UserId) => void;
    callMade: (data: { offer: SignalData; socket: string }) => void;
    answerMade: (data: { answer: SignalData; socket: string }) => void;
    iceCandidate: (data: { candidate: SignalData; socket: string }) => void;
    messageReaction: (data: {
        messageId: MessageId;
        userId: UserId;
        reactionType: string;
        action: 'added' | 'removed';
    }) => void | Promise<void>;
    messageDeleted: (data: { 
        messageId: MessageId; 
        conversationId: ConversationId;
        newLastMessage?: {
            id: MessageId;
            content: string;
            createdAt: string;
        } | null;
    }) => void | Promise<void>;
    typingStarted: (data: { userId: UserId; conversationId: ConversationId; name: string }) => void | Promise<void>;
    typingStopped: (data: { userId: UserId; conversationId: ConversationId; name: string }) => void | Promise<void>;
    messageDelivered: (data: { conversationId: ConversationId; messageIds: MessageId[] }) => void | Promise<void>;
    messageRead: (data: MessageReadEvent) => void | Promise<void>;
    messageReceived: (message: Message) => void | Promise<void>;
    notificationNew: (notification: HaemiNotification) => void | Promise<void>;
    notificationRead: (data: { id: string }) => void | Promise<void>;
    notificationDelete: (data: { id: string; messageId?: MessageId }) => void | Promise<void>;
    notificationReadAll: () => void | Promise<void>;
    userStatus: (data: { userId: UserId; isOnline: boolean; last_activity: string }) => void | Promise<void>;
    ackDelivery: (data: { 
        conversationId: ConversationId; 
        messageId: MessageId;
        senderId: UserId;
        senderRole: string;
    }) => void | Promise<void>;
    localMessageDeleted: (data: {
        messageId: MessageId;
        conversationId: ConversationId;
        newLastMessage?: {
            id: MessageId;
            content: string;
            createdAt: string;
        } | null;
    }) => void | Promise<void>;
    adminMirrorEvent: (payload: { event: string; data: unknown; timestamp: string }) => void | Promise<void>;
}

export interface ClientToServerEvents {
    joinConsultation: (appointmentId: string) => void;
    callUser: (data: { offer: SignalData; to: UserId }) => void;
    makeAnswer: (data: { answer: SignalData; to: UserId }) => void;
    iceCandidate: (data: { candidate: SignalData; to: UserId }) => void;
    ackDelivery: (data: { 
        conversationId: ConversationId; 
        messageId: MessageId;
        senderId: UserId;
        senderRole: string;
    }) => void;
    joinConversation: (conversationId: ConversationId) => void;
    messageRead: (data: MessageReadEvent) => void;
    typingStarted: (data: { conversationId: ConversationId; name: string }) => void;
    typingStopped: (data: { conversationId: ConversationId; name: string }) => void;
    heartbeat: () => void;
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

    private getSet<K extends keyof ServerToClientEvents>(event: K): Set<ServerToClientEvents[K]> {
        let set = this.listeners.get(event) as Set<ServerToClientEvents[K]> | undefined;
        if (!set) {
            set = new Set<ServerToClientEvents[K]>();
            this.listeners.set(event, set as Set<ServerToClientEvents[keyof ServerToClientEvents]>);
        }
        return set;
    }

    private attachAll(socket: SocketInstance): void {
        this.listeners.forEach((set, event) => {
            // Institutional Master Listener Pattern: Zero-Any implementation
            // Cast event as string for socket.on compatibility in generic iteration
            const eventName = String(event);
            socket.on(eventName as keyof ServerToClientEvents, (...args: unknown[]) => {
                set.forEach((cb: unknown) => {
                    if (typeof cb === 'function') {
                        try {
                            cb(...args);
                        } catch (err: unknown) {
                            const errorMsg = err instanceof Error ? err.message : String(err);
                            logger.error(`[SocketService] Error in listener for ${eventName}:`, { error: errorMsg });
                        }
                    }
                });
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
                // D10 REMEDIATION: Infinity attempts + exponential backoff capped at 30 s.
                // Prevents permanent socket-death after a brief WiFi blip or server
                // restart during investor demo. Google/Meta-grade resilience pattern.
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1_000,
                reconnectionDelayMax: 30_000,
                timeout: 20_000,
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
            logger.error(`[SocketService] Connection failed: ${err.message}`, { stack: err.stack });
            this.setState('FAILED');
        }
    }

    /**
     * 🔐 D9 REMEDIATION: Token Refresh-on-Reconnect
     *
     * socket.io-client freezes `socket.auth` at the moment `connect()` is called.
     * After a proactive token rotation the in-memory credential in api.ts is fresh,
     * but the socket still holds the original stale token in its auth object.
     *
     * Calling this method from a `reconnect_attempt` listener updates `socket.auth`
     * BEFORE the next connection handshake is sent to the server, ensuring the backend
     * JWT middleware always validates a live credential.
     *
     * Type-safe: `socket.auth` is typed as `{ [key: string]: unknown }` in socket.io-client,
     * so assigning `{ token: string }` is fully compliant — no cast required.
     */
    public updateAuthToken(freshToken: string): void {
        if (this.socket !== null) {
            this.socket.auth = { token: freshToken };
        }
    }

    /**
     * 🛡️ D12 REMEDIATION: Exposure of internal connection state.
     * Required for auxiliary presence-polling logic in ChatProvider
     * when the socket is in a disconnected state.
     */
    public isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    on<K extends keyof ServerToClientEvents>(
        event: K,
        cb: ServerToClientEvents[K]
    ) {
        const set = this.getSet(event);
        
        // P0: Idempotency Guard. Prevent multiple registrations for same callback
        if (set.has(cb)) {
            logger.warn(`[SocketService] Duplicate registration skipped for event: ${event}`);
            return;
        }

        const isFirst = set.size === 0;
        set.add(cb);

        // Institutional Master Listener Pattern: Zero-Any implementation
        if (this.socket && isFirst) {
            const eventName = String(event);
            this.socket.on(eventName as keyof ServerToClientEvents, (...args: unknown[]) => {
                const currentSet = this.listeners.get(event);
                if (currentSet) {
                    currentSet.forEach((l: unknown) => {
                        if (typeof l === 'function') l(...args);
                    });
                }
            });
        }
    }

    off<K extends keyof ServerToClientEvents>(
        event: K,
        cb: ServerToClientEvents[K]
    ) {
        const set = this.listeners.get(event);
        if (!set) return;

        set.delete(cb);

        // If no listeners left, unregister the master listener from the socket
        if (set.size === 0 && this.socket) {
            const eventName = String(event);
            this.socket.off(eventName as keyof ServerToClientEvents);
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