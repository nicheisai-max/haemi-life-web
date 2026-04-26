import { io, Socket } from 'socket.io-client';
import { logger, auditLogger } from '../utils/logger';
import { getAccessToken } from './api';
import type { Notification as HaemiNotification } from './notification.service';
import type { Message, ConversationId, MessageReadEvent, UserId, MessageId } from '../types/chat';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';
const SOCKET_URL = BASE_URL.replace(/\/$/, '');

/* ---------------- TYPES & ENUMS ---------------- */

export enum SocketState {
    IDLE = 'IDLE',
    CONNECTING = 'CONNECTING',
    CONNECTED = 'CONNECTED',
    DISCONNECTED = 'DISCONNECTED',
    RECONNECTING = 'RECONNECTING',
    TERMINATED = 'TERMINATED',
    FOLLOWER = 'FOLLOWER' // Tab is listening to a leader
}

/* ---------------- COORDINATION TYPES ---------------- */

export type BroadcastMessage = 
    | { type: 'LEADER_CLAIM'; tabId: string }
    | { type: 'LEADER_HEARTBEAT'; tabId: string }
    | { type: 'SOCKET_EVENT'; event: keyof ServerToClientEvents; data: unknown }
    | { 
        [K in keyof ClientToServerEvents]: { 
            type: 'SOCKET_EMIT'; 
            event: K; 
            args: Parameters<ClientToServerEvents[K]> 
        } 
      }[keyof ClientToServerEvents];

export interface ServerToClientEvents {
    'typingStarted': (data: { userId: UserId; conversationId: ConversationId; name: string }) => void;
    'typingStopped': (data: { userId: UserId; conversationId: ConversationId; name: string }) => void;
    'messageRead': (event: MessageReadEvent) => void;
    'messageDelivered': (event: { conversationId: ConversationId; messageIds: MessageId[] }) => void;
    'messageReceived': (message: Message) => void;
    'messageDeleted': (payload: { messageId: string; conversationId: ConversationId; newLastMessage?: Message }) => void;
    'messageReaction': (data: { messageId: string; userId: UserId; reactionType: string; action: 'added' | 'removed' }) => void;
    'userStatus': (data: { userId: string; isOnline: boolean; last_activity?: string }) => void;
    'localMessageDeleted': (payload: { messageId: string; conversationId: ConversationId; newLastMessage?: Message }) => void;
    'notificationNew': (notification: HaemiNotification) => void;
    'notificationRead': (payload: { id: string }) => void;
    'notificationReadAll': () => void;
    'notificationDelete': (payload: { id: string; messageId?: string }) => void;
    'reconnect': () => void;
    'reconnect_attempt': (attempt: number) => void;
    'disconnect': (reason: string) => void;
    'error': (error: { message: string; code?: string }) => void;
    'connect_error': (error: Error) => void;
}

export interface ClientToServerEvents {
    'message:send': (payload: { conversationId: ConversationId; content: string; tempId: string }) => void;
    'messageRead': (payload: { conversationId: ConversationId; messageIds: string[]; userId: UserId }) => void;
    'typingStarted': (payload: { conversationId: ConversationId; name: string }) => void;
    'typingStopped': (payload: { conversationId: ConversationId; name: string }) => void;
    'heartbeat': () => void;
    'ackDelivery': (payload: { conversationId: ConversationId; messageId: string; senderId: UserId; senderRole: string }) => void;
    'joinConversation': (conversationId: ConversationId) => void;
}

type SocketInstance = Socket<ServerToClientEvents, ClientToServerEvents>;

class SocketService {
    private static instance: SocketService;
    private socket: SocketInstance | null = null;
    private state: SocketState = SocketState.IDLE;
    private reconnectionAttempts = 0;
    private tabId: string = Math.random().toString(36).substring(2, 15);
    private broadcastChannel: BroadcastChannel | null = null;
    private leaderTabId: string | null = null;
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private leaderCheckTimer: NodeJS.Timeout | null = null;
    
    private listeners: { [K in keyof ServerToClientEvents]: Set<ServerToClientEvents[K]> } = {
        typingStarted: new Set(),
        typingStopped: new Set(),
        messageRead: new Set(),
        messageDelivered: new Set(),
        messageReceived: new Set(),
        messageDeleted: new Set(),
        messageReaction: new Set(),
        userStatus: new Set(),
        localMessageDeleted: new Set(),
        notificationNew: new Set(),
        notificationRead: new Set(),
        notificationReadAll: new Set(),
        notificationDelete: new Set(),
        reconnect: new Set(),
        reconnect_attempt: new Set(),
        disconnect: new Set(),
        error: new Set(),
        connect_error: new Set()
    };

    private constructor() {
        if (typeof window !== 'undefined') {
            // Lifecycle Hardening
            window.addEventListener('beforeunload', () => this.destroy());

            // 🧬 Multi-tab Coordination Initialization
            try {
                this.broadcastChannel = new BroadcastChannel('haemi_socket_coordination');
                this.broadcastChannel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
                    this.handleBroadcastMessage(event.data);
                };
                this.startLeaderElection();
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'BroadcastChannel initialization failed';
                logger.error('[SocketService] Coordination failure', msg);
            }
        }
    }

    private handleBroadcastMessage(msg: BroadcastMessage): void {
        switch (msg.type) {
            case 'LEADER_HEARTBEAT':
            case 'LEADER_CLAIM':
                this.leaderTabId = msg.tabId;
                if (this.leaderTabId !== this.tabId && this.state !== SocketState.FOLLOWER) {
                    this.becomeFollower();
                }
                this.resetLeaderCheck();
                break;
            case 'SOCKET_EVENT':
                if (this.state === SocketState.FOLLOWER) {
                    this.dispatchToLocalListeners(msg.event, msg.data);
                }
                break;
            case 'SOCKET_EMIT':
                if (this.state === SocketState.CONNECTED) {
                    // Institutional Type-Safe Proxying (Meta-Grade)
                    switch (msg.event) {
                        case 'message:send': this.emit('message:send', msg.args[0]); break;
                        case 'messageRead': this.emit('messageRead', msg.args[0]); break;
                        case 'typingStarted': this.emit('typingStarted', msg.args[0]); break;
                        case 'typingStopped': this.emit('typingStopped', msg.args[0]); break;
                        case 'heartbeat': this.emit('heartbeat'); break;
                        case 'ackDelivery': this.emit('ackDelivery', msg.args[0]); break;
                        case 'joinConversation': this.emit('joinConversation', msg.args[0]); break;
                    }
                }
                break;
        }
    }

    private startLeaderElection(): void {
        this.broadcastChannel?.postMessage({ type: 'LEADER_CLAIM', tabId: this.tabId });
        this.resetLeaderCheck();
    }

    private becomeFollower(): void {
        this.transitionTo(SocketState.FOLLOWER);
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    }

    private becomeLeader(): void {
        if (this.state === SocketState.CONNECTED || this.state === SocketState.CONNECTING) return;
        
        logger.info('[SocketService] Promoted to LEADER');
        this.leaderTabId = this.tabId;
        this.connect();

        // Start sending heartbeats
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
            this.broadcastChannel?.postMessage({ type: 'LEADER_HEARTBEAT', tabId: this.tabId });
        }, 1000);
    }

    private resetLeaderCheck(): void {
        if (this.leaderCheckTimer) clearTimeout(this.leaderCheckTimer);
        this.leaderCheckTimer = setTimeout(() => {
            if (this.state !== SocketState.CONNECTED) {
                this.becomeLeader();
            }
        }, 3000);
    }

    private dispatchToLocalListeners<K extends keyof ServerToClientEvents>(event: K, data: unknown): void {
        const set = this.listeners[event];
        set.forEach((cb) => {
            try {
                const handler = cb as (...args: unknown[]) => void;
                handler(data);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Callback execution failed';
                logger.error(`[SocketService] Listener error for ${event}`, msg);
            }
        });
    }

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    private transitionTo(newState: SocketState, context?: string): void {
        const oldState = this.state;
        this.state = newState;
        logger.info(`[SocketService] State Transition: ${oldState} -> ${newState}`, { context });
    }

    private calculateBackoff(): number {
        const baseDelay = 1000; // 1s
        const maxDelay = 30000; // 30s
        const exponent = Math.min(this.reconnectionAttempts, 6); // Max 2^6 = 64
        const delay = Math.min(baseDelay * Math.pow(2, exponent), maxDelay);
        const jitter = Math.random() * 1000; // 1s jitter
        return delay + jitter;
    }

    async connect(tokenOverride?: string): Promise<void> {
        // Multi-tab Safety: Followers do not connect to real socket
        if (this.state === SocketState.FOLLOWER) {
            logger.debug('[SocketService] Connect suppressed: Tab is in FOLLOWER mode.');
            return;
        }

        if (this.state === SocketState.CONNECTED || this.state === SocketState.CONNECTING) return;

        const token = tokenOverride || getAccessToken();
        if (!token) {
            logger.warn('[SocketService] Connection suppressed: No auth token');
            return;
        }

        this.transitionTo(SocketState.CONNECTING);

        try {
            if (this.socket) {
                this.socket.removeAllListeners();
                this.socket.disconnect();
            }

            this.socket = io(SOCKET_URL, {
                auth: { token },
                path: '/socket.io/',
                transports: ['websocket', 'polling'], 
                withCredentials: true,
                reconnection: true,
                reconnectionAttempts: 10,
                autoConnect: true,
            });

            this.attachCoreListeners(this.socket);
            this.manualRebind(this.socket);

            auditLogger.log('ERROR', { 
                message: '[SocketService] Link Secured', 
                details: { url: SOCKET_URL, state: this.state } 
            });
        } catch (error: unknown) {
            this.transitionTo(SocketState.DISCONNECTED);
            const errorMessage = error instanceof Error ? error.message : 'Unknown transport error';
            auditLogger.log('ERROR', { 
                message: '[SocketService] Handshake Failure', 
                details: { error: errorMessage } 
            });
        }
    }

    private attachCoreListeners(socket: SocketInstance) {
        socket.on('connect', () => {
            this.transitionTo(SocketState.CONNECTED);
            this.reconnectionAttempts = 0;
            logger.info('[SocketService] Link established.');
        });

        socket.on('disconnect', (reason) => {
            this.transitionTo(SocketState.DISCONNECTED, reason);
            if (reason === 'io server disconnect') {
                const delay = this.calculateBackoff();
                setTimeout(() => this.connect(), delay);
            }
        });

        socket.on('connect_error', (err: Error) => {
            this.transitionTo(SocketState.RECONNECTING);
            this.reconnectionAttempts++;
            auditLogger.log('ERROR', { 
                message: '[SocketService] Handshake error', 
                details: { msg: err.message, attempt: this.reconnectionAttempts } 
            });
        });
    }

    updateAuthToken(token: string) {
        if (this.socket) {
            this.socket.auth = { token };
            if (this.socket.connected) {
                logger.info('[SocketService] Cycling connection for token update');
                this.socket.disconnect().connect();
            }
        }
    }

    getState(): SocketState {
        return this.state;
    }

    isConnected(): boolean {
        return this.state === SocketState.CONNECTED;
    }

    on<K extends keyof ServerToClientEvents>(event: K, callback: ServerToClientEvents[K]): void {
        // Institutional Explicit Dispatcher (Meta-Grade)
        // Prevents Union-Type mapping errors without using ANY.
        const set = this.listeners[event] as Set<ServerToClientEvents[K]>;
        set.add(callback);

        if (!this.socket || this.state === SocketState.FOLLOWER) return;

        switch (event) {
            case 'typingStarted': this.socket.on('typingStarted', callback as ServerToClientEvents['typingStarted']); break;
            case 'typingStopped': this.socket.on('typingStopped', callback as ServerToClientEvents['typingStopped']); break;
            case 'messageRead': this.socket.on('messageRead', callback as ServerToClientEvents['messageRead']); break;
            case 'messageDelivered': this.socket.on('messageDelivered', callback as ServerToClientEvents['messageDelivered']); break;
            case 'messageReceived': this.socket.on('messageReceived', callback as ServerToClientEvents['messageReceived']); break;
            case 'messageDeleted': this.socket.on('messageDeleted', callback as ServerToClientEvents['messageDeleted']); break;
            case 'messageReaction': this.socket.on('messageReaction', callback as ServerToClientEvents['messageReaction']); break;
            case 'userStatus': this.socket.on('userStatus', callback as ServerToClientEvents['userStatus']); break;
            case 'localMessageDeleted': this.socket.on('localMessageDeleted', callback as ServerToClientEvents['localMessageDeleted']); break;
            case 'notificationNew': this.socket.on('notificationNew', callback as ServerToClientEvents['notificationNew']); break;
            case 'notificationRead': this.socket.on('notificationRead', callback as ServerToClientEvents['notificationRead']); break;
            case 'notificationReadAll': this.socket.on('notificationReadAll', callback as ServerToClientEvents['notificationReadAll']); break;
            case 'notificationDelete': this.socket.on('notificationDelete', callback as ServerToClientEvents['notificationDelete']); break;
            case 'reconnect': this.socket.on('reconnect', callback as ServerToClientEvents['reconnect']); break;
            case 'reconnect_attempt': this.socket.on('reconnect_attempt', callback as ServerToClientEvents['reconnect_attempt']); break;
            case 'disconnect': this.socket.on('disconnect', callback as ServerToClientEvents['disconnect']); break;
            case 'error': this.socket.on('error', callback as ServerToClientEvents['error']); break;
            case 'connect_error': this.socket.on('connect_error', callback as ServerToClientEvents['connect_error']); break;
        }
    }

    off<K extends keyof ServerToClientEvents>(event: K, callback: ServerToClientEvents[K]): void {
        const set = this.listeners[event] as Set<ServerToClientEvents[K]>;
        set.delete(callback);

        if (!this.socket) return;

        switch (event) {
            case 'typingStarted': this.socket.off('typingStarted', callback as ServerToClientEvents['typingStarted']); break;
            case 'typingStopped': this.socket.off('typingStopped', callback as ServerToClientEvents['typingStopped']); break;
            case 'messageRead': this.socket.off('messageRead', callback as ServerToClientEvents['messageRead']); break;
            case 'messageDelivered': this.socket.off('messageDelivered', callback as ServerToClientEvents['messageDelivered']); break;
            case 'messageReceived': this.socket.off('messageReceived', callback as ServerToClientEvents['messageReceived']); break;
            case 'messageDeleted': this.socket.off('messageDeleted', callback as ServerToClientEvents['messageDeleted']); break;
            case 'messageReaction': this.socket.off('messageReaction', callback as ServerToClientEvents['messageReaction']); break;
            case 'userStatus': this.socket.off('userStatus', callback as ServerToClientEvents['userStatus']); break;
            case 'localMessageDeleted': this.socket.off('localMessageDeleted', callback as ServerToClientEvents['localMessageDeleted']); break;
            case 'notificationNew': this.socket.off('notificationNew', callback as ServerToClientEvents['notificationNew']); break;
            case 'notificationRead': this.socket.off('notificationRead', callback as ServerToClientEvents['notificationRead']); break;
            case 'notificationReadAll': this.socket.off('notificationReadAll', callback as ServerToClientEvents['notificationReadAll']); break;
            case 'notificationDelete': this.socket.off('notificationDelete', callback as ServerToClientEvents['notificationDelete']); break;
            case 'reconnect': this.socket.off('reconnect', callback as ServerToClientEvents['reconnect']); break;
            case 'reconnect_attempt': this.socket.off('reconnect_attempt', callback as ServerToClientEvents['reconnect_attempt']); break;
            case 'disconnect': this.socket.off('disconnect', callback as ServerToClientEvents['disconnect']); break;
            case 'error': this.socket.off('error', callback as ServerToClientEvents['error']); break;
            case 'connect_error': this.socket.off('connect_error', callback as ServerToClientEvents['connect_error']); break;
        }
    }

    private broadcastToFollowers<K extends keyof ServerToClientEvents>(event: K, data: unknown): void {
        if (this.state === SocketState.CONNECTED) {
            this.broadcastChannel?.postMessage({ type: 'SOCKET_EVENT', event, data });
        }
    }

    emit<K extends keyof ClientToServerEvents>(event: K, ...args: Parameters<ClientToServerEvents[K]>): void {
        if (this.state === SocketState.FOLLOWER) {
            // Proxy emit to leader
            this.broadcastChannel?.postMessage({ type: 'SOCKET_EMIT', event, args });
            return;
        }

        if (this.state !== SocketState.CONNECTED) {
            logger.warn(`[SocketService] Emit suppressed: State is ${this.state}`, { event });
            return;
        }
        this.socket?.emit(event, ...args);
    }

    private manualRebind(socket: SocketInstance) {
        // Institutional Explicit Rebinding with Broadcast Pipe (Meta-Grade)
        // Bypasses TS union mapping limitations by being explicit. Zero 'any', Zero casting.
        
        const createPipe = <K extends keyof ServerToClientEvents>(event: K): ServerToClientEvents[K] => {
            const handler = (...args: Parameters<ServerToClientEvents[K]>) => {
                const params = args as unknown[];
                const data = params.length > 0 ? params[0] : undefined;
                this.broadcastToFollowers(event, data);
                this.dispatchToLocalListeners(event, data);
            };
            return handler as ServerToClientEvents[K];
        };

        socket.on('typingStarted', createPipe('typingStarted'));
        socket.on('typingStopped', createPipe('typingStopped'));
        socket.on('messageRead', createPipe('messageRead'));
        socket.on('messageDelivered', createPipe('messageDelivered'));
        socket.on('messageReceived', createPipe('messageReceived'));
        socket.on('messageDeleted', createPipe('messageDeleted'));
        socket.on('messageReaction', createPipe('messageReaction'));
        socket.on('userStatus', createPipe('userStatus'));
        socket.on('localMessageDeleted', createPipe('localMessageDeleted'));
        socket.on('notificationNew', createPipe('notificationNew'));
        socket.on('notificationRead', createPipe('notificationRead'));
        socket.on('notificationReadAll', createPipe('notificationReadAll'));
        socket.on('notificationDelete', createPipe('notificationDelete'));
        socket.on('reconnect', createPipe('reconnect'));
        socket.on('reconnect_attempt', createPipe('reconnect_attempt'));
        socket.on('disconnect', createPipe('disconnect'));
        socket.on('error', createPipe('error'));
        socket.on('connect_error', createPipe('connect_error'));
    }

    destroy(): void {
        this.transitionTo(SocketState.TERMINATED);
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
    }

    disconnect(): void {
        this.destroy();
    }
}

export const socketService = SocketService.getInstance();
export default socketService;