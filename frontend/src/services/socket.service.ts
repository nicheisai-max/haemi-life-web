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

export interface ServerToClientEvents {
    connect: () => void;
    disconnect: (reason: string) => void;
    connect_error: (err: Error) => void;
    reconnect_attempt: (attempt: number) => void;
    reconnect_failed: () => void;
    reconnect: () => void;
    'participant-joined': (participantId: string) => void;
    'call-made': (data: { offer: SignalData; socket: string }) => void;
    'answer-made': (data: { answer: SignalData; socket: string }) => void;
    'ice-candidate': (data: { candidate: SignalData; socket: string }) => void;
    message_reaction: (data: {
        messageId: string;
        userId: string;
        reactionType: string;
        action: 'added' | 'removed';
    }) => void;
    message_deleted: (data: { messageId: string; forEveryone: boolean }) => void;
    typing_started: (data: { userId: string } | { conversationId: string; name: string }) => void;
    typing_stopped: (data: { userId: string } | { conversationId: string; name: string }) => void;
    message_delivered: (data: { conversationId: string; messageIds: string[] }) => void;
    message_read: (data: { conversationId: string; user_id: string }) => void;
    message_received: (message: Message) => void;
    'notification:new': (notification: HaemiNotification) => void;
}

export interface ClientToServerEvents {
    'join-consultation': (appointmentId: string) => void;
    'call-user': (data: { offer: SignalData; to: string }) => void;
    'make-answer': (data: { answer: SignalData; to: string }) => void;
    'ice-candidate': (data: { candidate: SignalData; to: string }) => void;
    ack_delivery: (data: { conversationId: string; messageId: string }) => void;
    join_conversation: (conversationId: string) => void;
    ack_read: (data: { conversationId: string; user_id: string }) => void;
    typing_started: (data: { conversationId: string; name: string }) => void;
    typing_stopped: (data: { conversationId: string; name: string }) => void;
}

/* ---------------- TYPES ---------------- */

type SocketInstance = Socket<ServerToClientEvents, ClientToServerEvents>;

type ListenerMap = Map<
    keyof ServerToClientEvents,
    Set<(...args: unknown[]) => void>
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
                socket.on(event, cb as never);
            });
        });
    }

    async connect(tokenOverride?: string) {
        const token = tokenOverride || getAccessToken();
        if (!token) return;

        try {
            const socket = io(SOCKET_URL, {
                auth: { token },
                transports: ['polling', 'websocket'],
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

        } catch (e) {
            const error = e instanceof Error ? e : new Error('Unknown error');
            logger.error(error.message);
            this.setState('FAILED');
        }
    }

    on<K extends keyof ServerToClientEvents>(
        event: K,
        cb: ServerToClientEvents[K]
    ) {
        const set = this.getSet(event);
        const wrapped = cb as unknown as (...args: unknown[]) => void;

        set.add(wrapped);

        if (this.socket) {
            this.socket.on(event, wrapped as never);
        }
    }

    off<K extends keyof ServerToClientEvents>(
        event: K,
        cb: ServerToClientEvents[K]
    ) {
        const set = this.listeners.get(event);
        if (!set) return;

        const wrapped = cb as unknown as (...args: unknown[]) => void;
        set.delete(wrapped);

        if (this.socket) {
            this.socket.off(event, wrapped as never);
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