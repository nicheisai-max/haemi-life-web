import { io, Socket } from 'socket.io-client';
import { logger, auditLogger } from '../utils/logger';
import { getAccessToken } from './api';
import type { Notification as HaemiNotification } from './notification.service';
import type { Message, ConversationId, MessageReadEvent, UserId, MessageId } from '../types/chat';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';
const SOCKET_URL = BASE_URL.replace(/\/$/, '');
const SOCKET_PATH = '/socket.io/';

const LEADER_HEARTBEAT_INTERVAL_MS = 1000;
const LEADER_TIMEOUT_MS = 3000;
const RECONNECT_BACKOFF_BASE_MS = 1000;
const RECONNECT_BACKOFF_MAX_MS = 30000;
const RECONNECT_BACKOFF_MAX_EXPONENT = 6;

/**
 * Number of consecutive failed reconnect attempts after which the socket
 * service raises the application-layer "backend unreachable" signal
 * (`haemi:backend-down`). Single transient disconnects are common
 * (network blip, suspended tab waking up) and must NOT surface a banner.
 * Three sustained failures (≈ 1 + 2 + 4 = 7 s of attempted recovery)
 * is the empirical threshold above which the user benefits from being
 * told something is genuinely wrong upstream rather than waiting in
 * confused silence. The boundary equality check at the dispatch site
 * ensures the event fires exactly once per outage, not once per attempt.
 */
const SUSTAINED_RECONNECT_THRESHOLD = 3;

export enum SocketState {
    IDLE = 'IDLE',
    CONNECTING = 'CONNECTING',
    CONNECTED = 'CONNECTED',
    DISCONNECTED = 'DISCONNECTED',
    RECONNECTING = 'RECONNECTING',
    TERMINATED = 'TERMINATED',
    FOLLOWER = 'FOLLOWER'
}

// Admin observability event payloads — mirrored from the shared schema in
// shared/schemas/admin-events.schema.ts so backend and frontend share one
// type contract. Frontend consumers should still parse incoming payloads
// through `AdminEventSchemaMap` at the call site (defense-in-depth), but
// the static contract here gives compile-time autocompletion for
// `socketService.on('screening:reordered', ...)`.
import type {
    ScreeningReorderedEvent,
    AuditLogEvent,
    SecurityEvent as AdminSecurityEvent,
    SessionCreatedEvent,
    SessionRevokedEvent,
    DoctorVerifiedEvent,
    UserRegisteredEvent,
    UserStatusChangedEvent,
    AppointmentOverdueEvent,
} from '../../../shared/schemas/admin-events.schema';

export interface ServerToClientEvents {
    'typingStarted': (data: { userId: UserId; conversationId: ConversationId; name: string }) => void;
    'typingStopped': (data: { userId: UserId; conversationId: ConversationId; name: string }) => void;
    'messageRead': (event: MessageReadEvent) => void;
    // P1 SOCKET CONTRACT FIX (Phase 12): align with backend
    // MessageDeliveredPayload, which emits userId and an ISO timestamp on
    // the same wire frame. Previously these fields were silently dropped
    // by frontend listeners that destructured the narrower shape.
    'messageDelivered': (event: { conversationId: ConversationId; messageIds: MessageId[]; userId: UserId; timestamp: string }) => void;
    'messageReceived': (message: Message) => void;
    'messageDeleted': (payload: { messageId: string; conversationId: ConversationId; newLastMessage?: Message }) => void;
    'messageReaction': (data: { messageId: string; userId: UserId; reactionType: string; action: 'added' | 'removed' }) => void;
    // `lastActivity` is always emitted by the backend
    // (status.service.ts -> UserPresencePayload — non-optional ISO string).
    // Marking it required here makes the type contract honest with the
    // wire reality and removes silent `undefined`-handling from every
    // consumer (presence-context, chat-hub, storage).
    'userStatus': (data: { userId: string; isOnline: boolean; lastActivity: string }) => void;
    'localMessageDeleted': (payload: { messageId: string; conversationId: ConversationId; newLastMessage?: Message }) => void;
    'notificationNew': (notification: HaemiNotification) => void;
    'notificationRead': (payload: { id: string }) => void;
    'notificationReadAll': () => void;
    'notificationDelete': (payload: { id: string; messageId?: string }) => void;
    'reconnect': () => void;
    'reconnect_attempt': (attempt: number) => void;
    'disconnect': (reason: string) => void;
    'error': (error: Error) => void;
    'connect_error': (error: Error) => void;
    // ─── Admin observability (typed contract — see shared/schemas/admin-events.schema.ts)
    'screening:reordered': (payload: ScreeningReorderedEvent) => void;
    'audit:new': (payload: AuditLogEvent) => void;
    'security:event': (payload: AdminSecurityEvent) => void;
    'session:created': (payload: SessionCreatedEvent) => void;
    'session:revoked': (payload: SessionRevokedEvent) => void;
    'doctor:verified': (payload: DoctorVerifiedEvent) => void;
    'user:registered': (payload: UserRegisteredEvent) => void;
    'user:status_changed': (payload: UserStatusChangedEvent) => void;
    'appointment:overdue': (payload: AppointmentOverdueEvent) => void;
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
type S2CName = keyof ServerToClientEvents;
type C2SName = keyof ClientToServerEvents;

type LeaderClaim = { type: 'LEADER_CLAIM'; tabId: string };
type LeaderHeartbeat = { type: 'LEADER_HEARTBEAT'; tabId: string };
type SocketEvent = { type: 'SOCKET_EVENT'; event: S2CName; data: unknown };
type SocketEmit = {
    [K in C2SName]: {
        type: 'SOCKET_EMIT';
        event: K;
        args: Parameters<ClientToServerEvents[K]>;
    }
}[C2SName];

export type BroadcastMessage = LeaderClaim | LeaderHeartbeat | SocketEvent | SocketEmit;

const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null;

const hasStringField = (v: unknown, key: string): boolean =>
    isRecord(v) && typeof v[key] === 'string';

const isTypingPayload = (v: unknown): v is { userId: UserId; conversationId: ConversationId; name: string } =>
    isRecord(v)
    && typeof v.userId === 'string'
    && typeof v.conversationId === 'string'
    && typeof v.name === 'string';

const isMessageReadEventPayload = (v: unknown): v is MessageReadEvent =>
    isRecord(v)
    && typeof v.conversationId === 'string'
    && Array.isArray(v.messageIds);

const isMessageDeliveredPayload = (v: unknown): v is { conversationId: ConversationId; messageIds: MessageId[]; userId: UserId; timestamp: string } =>
    isRecord(v)
    && typeof v.conversationId === 'string'
    && Array.isArray(v.messageIds)
    && typeof v.userId === 'string'
    && typeof v.timestamp === 'string';

const isMessage = (v: unknown): v is Message =>
    hasStringField(v, 'id');

const isMessageDeletedPayload = (v: unknown): v is { messageId: string; conversationId: ConversationId; newLastMessage?: Message } =>
    isRecord(v)
    && typeof v.messageId === 'string'
    && typeof v.conversationId === 'string';

const isMessageReactionPayload = (v: unknown): v is { messageId: string; userId: UserId; reactionType: string; action: 'added' | 'removed' } =>
    isRecord(v)
    && typeof v.messageId === 'string'
    && typeof v.userId === 'string'
    && typeof v.reactionType === 'string'
    && (v.action === 'added' || v.action === 'removed');

const isUserStatusPayload = (v: unknown): v is { userId: string; isOnline: boolean; lastActivity: string } =>
    isRecord(v)
    && typeof v.userId === 'string'
    && typeof v.isOnline === 'boolean'
    && typeof v.lastActivity === 'string';

const isHaemiNotification = (v: unknown): v is HaemiNotification =>
    isRecord(v) && typeof v.type === 'string';

const isIdPayload = (v: unknown): v is { id: string } =>
    hasStringField(v, 'id');

/**
 * Strict listener registry. Each event key is bound to a Set of typed
 * callbacks. The single narrowing assertion at the iteration boundary
 * is unavoidable for a runtime Set-of-callbacks pattern; it carries no
 * data transformation and no double-cast.
 */
class TypedListenerStore {
    private store: Map<S2CName, Set<unknown>> = new Map();

    add<K extends S2CName>(event: K, cb: ServerToClientEvents[K]): void {
        let set = this.store.get(event);
        if (!set) {
            set = new Set();
            this.store.set(event, set);
        }
        set.add(cb);
    }

    delete<K extends S2CName>(event: K, cb: ServerToClientEvents[K]): void {
        this.store.get(event)?.delete(cb);
    }

    dispatch<K extends S2CName>(event: K, run: (cb: ServerToClientEvents[K]) => void): void {
        const set = this.store.get(event);
        if (!set) return;
        set.forEach((cb) => run(cb as ServerToClientEvents[K]));
    }

    clear(): void {
        this.store.clear();
    }
}

class SocketService {
    private static instance: SocketService;
    private socket: SocketInstance | null = null;
    private state: SocketState = SocketState.IDLE;
    private reconnectionAttempts = 0;
    private tabId: string = Math.random().toString(36).substring(2, 15);
    private broadcastChannel: BroadcastChannel | null = null;
    private leaderTabId: string | null = null;
    private leaderHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private leaderCheckTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingFollowerTransition = false;
    private listeners: TypedListenerStore = new TypedListenerStore();
    private deferredConnectBound = false;

    private constructor() {
        if (typeof window === 'undefined') return;

        this.openBroadcastChannel();
        this.startLeaderElection();

        // bfcache-friendly: do NOT close the socket on pagehide/beforeunload.
        // The browser will close the transport cleanly on a real unload, and
        // suppressing those listeners lets the page enter the back-forward
        // cache. On bfcache restoration the socket may have been frozen, so
        // we re-establish on `pageshow` if persisted.
        window.addEventListener('pageshow', (event: PageTransitionEvent): void => {
            if (event.persisted && !this.isConnected() && this.state !== SocketState.FOLLOWER) {
                void this.connect();
            }
        });
    }

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    private openBroadcastChannel(): void {
        try {
            this.broadcastChannel = new BroadcastChannel('haemi_socket_coordination');
            // The `onmessage` body is deferred by one microtask so the native
            // `message` event handler returns to the browser immediately.
            // `handleBroadcastMessage` may transitively trigger
            // `dispatchToLocalListeners`, which fires React state updates in
            // the chat / notification / presence providers — and React 18
            // does NOT auto-batch setState calls inside browser-native
            // events. Running the cascade inside a microtask keeps the
            // synchronous handler span sub-millisecond (eliminating the
            // `[Violation] 'message' handler took Xms` warning) AND lets
            // React's automatic batching coalesce the cascade into a single
            // render commit. Microtasks run FIFO before the next task tick,
            // so cross-tab message ordering is preserved.
            this.broadcastChannel.onmessage = (event: MessageEvent<BroadcastMessage>): void => {
                queueMicrotask(() => this.handleBroadcastMessage(event.data));
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('[SocketService] Failed to open BroadcastChannel', { error: message });
        }
    }

    private postBroadcast(message: BroadcastMessage): void {
        if (!this.broadcastChannel) return;
        try {
            this.broadcastChannel.postMessage(message);
        } catch (err: unknown) {
            const detail = err instanceof Error ? err.message : String(err);
            logger.warn('[SocketService] BroadcastChannel post failed', { error: detail, type: message.type });
        }
    }

    private transitionTo(newState: SocketState, context?: string): void {
        const oldState = this.state;
        this.state = newState;
        logger.info(`[SocketService] State Transition: ${oldState} -> ${newState}`, { context });
    }

    private calculateBackoff(): number {
        const exponent = Math.min(this.reconnectionAttempts, RECONNECT_BACKOFF_MAX_EXPONENT);
        const delay = Math.min(RECONNECT_BACKOFF_BASE_MS * Math.pow(2, exponent), RECONNECT_BACKOFF_MAX_MS);
        return delay + Math.random() * 1000;
    }

    /**
     * Idempotent connect. If no token is yet available (e.g. during the
     * post-refresh auth boot), defers until `auth:token-refreshed` fires
     * exactly once, then retries.
     */
    public async connect(tokenOverride?: string): Promise<void> {
        if (this.state === SocketState.FOLLOWER) return;
        if (this.state === SocketState.CONNECTING) return;
        if (this.state === SocketState.CONNECTED && tokenOverride === undefined) return;
        if (this.state === SocketState.TERMINATED) return;

        const token = tokenOverride ?? getAccessToken();
        if (!token) {
            this.bindDeferredConnect();
            return;
        }

        this.transitionTo(SocketState.CONNECTING);

        try {
            if (this.socket) {
                this.socket.removeAllListeners();
                this.socket.disconnect();
                this.socket = null;
            }

            this.socket = io(SOCKET_URL, {
                auth: { token },
                path: SOCKET_PATH,
                transports: ['polling', 'websocket'],
                withCredentials: true,
                reconnection: true
            });

            this.attachCoreListeners(this.socket);
            this.attachEventPipes(this.socket);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.transitionTo(SocketState.DISCONNECTED, 'connect_failure');
            auditLogger.log('ERROR', { message: '[SocketService] Connection failed', details: { error: message } });
        }
    }

    private bindDeferredConnect(): void {
        if (this.deferredConnectBound) return;
        if (typeof window === 'undefined') return;
        this.deferredConnectBound = true;
        const onTokenReady = (): void => {
            this.deferredConnectBound = false;
            void this.connect();
        };
        window.addEventListener('auth:token-refreshed', onTokenReady, { once: true });
    }

    private attachCoreListeners(socket: SocketInstance): void {
        socket.on('connect', (): void => {
            if (this.pendingFollowerTransition) {
                this.becomeFollower();
                return;
            }
            // Successful connection clears the sustained-outage signal so
            // the NetworkStatusProvider's backend-down banner dismisses.
            // The dispatch is idempotent — broadcasting "recovered" while
            // already-recovered is a no-op for the listener.
            const wasOutage = this.reconnectionAttempts >= SUSTAINED_RECONNECT_THRESHOLD;
            this.transitionTo(SocketState.CONNECTED);
            this.reconnectionAttempts = 0;
            if (wasOutage && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('haemi:backend-recovered'));
            }
        });

        socket.on('disconnect', (reason: string): void => {
            if (this.state === SocketState.FOLLOWER || this.state === SocketState.TERMINATED) return;
            this.transitionTo(SocketState.DISCONNECTED, reason);
            if (reason === 'io server disconnect') {
                const delay = this.calculateBackoff();
                setTimeout((): void => { void this.connect(); }, delay);
            }
        });

        socket.on('connect_error', (err: Error): void => {
            logger.error('[SocketService] Connection Error', {
                message: err.message,
                reconnectionAttempts: this.reconnectionAttempts
            });

            // Edge-trigger: after `SUSTAINED_RECONNECT_THRESHOLD` consecutive
            // failed attempts (defined as a module-level constant alongside
            // the existing backoff configuration), raise the application-
            // layer outage signal. Single transient disconnects do NOT
            // surface a banner — only sustained inability to reconnect.
            // The threshold compare against `< +1` ensures we fire on the
            // boundary attempt exactly once.
            if (this.reconnectionAttempts + 1 === SUSTAINED_RECONNECT_THRESHOLD && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('haemi:backend-down'));
            }

            if (this.pendingFollowerTransition) {
                this.becomeFollower();
                return;
            }
            if (this.state === SocketState.FOLLOWER || this.state === SocketState.TERMINATED) return;
            this.transitionTo(SocketState.RECONNECTING, 'connect_error');
            this.reconnectionAttempts++;
        });
    }

    private handleBroadcastMessage(msg: BroadcastMessage): void {
        switch (msg.type) {
            case 'LEADER_HEARTBEAT':
            case 'LEADER_CLAIM': {
                this.leaderTabId = msg.tabId;
                if (this.leaderTabId !== this.tabId && this.state !== SocketState.FOLLOWER) {
                    if (this.state === SocketState.CONNECTING) {
                        this.pendingFollowerTransition = true;
                    } else {
                        this.becomeFollower();
                    }
                }
                this.resetLeaderCheck();
                break;
            }
            case 'SOCKET_EVENT': {
                if (this.state === SocketState.FOLLOWER) {
                    this.dispatchToLocalListeners(msg.event, msg.data);
                }
                break;
            }
            case 'SOCKET_EMIT': {
                if (this.state === SocketState.CONNECTED) {
                    this.proxyEmit(msg);
                }
                break;
            }
        }
    }

    /**
     * Strict-typed proxy of a follower-tab emit through the leader's socket.
     * Each branch narrows `msg.event` so `msg.args` is type-correlated with
     * the corresponding `ClientToServerEvents` signature.
     */
    private proxyEmit(msg: SocketEmit): void {
        if (!this.socket) return;
        switch (msg.event) {
            case 'heartbeat':
                this.socket.emit('heartbeat');
                break;
            case 'joinConversation':
                this.socket.emit('joinConversation', ...msg.args);
                break;
            case 'messageRead':
                this.socket.emit('messageRead', ...msg.args);
                break;
            case 'message:send':
                this.socket.emit('message:send', ...msg.args);
                break;
            case 'typingStarted':
                this.socket.emit('typingStarted', ...msg.args);
                break;
            case 'typingStopped':
                this.socket.emit('typingStopped', ...msg.args);
                break;
            case 'ackDelivery':
                this.socket.emit('ackDelivery', ...msg.args);
                break;
        }
    }

    private startLeaderElection(): void {
        this.postBroadcast({ type: 'LEADER_CLAIM', tabId: this.tabId });
        this.resetLeaderCheck();
    }

    private becomeFollower(): void {
        this.pendingFollowerTransition = false;
        this.transitionTo(SocketState.FOLLOWER);
        if (this.leaderCheckTimer) clearTimeout(this.leaderCheckTimer);
        if (this.leaderHeartbeatTimer) clearInterval(this.leaderHeartbeatTimer);
        if (this.socket) {
            this.socket.removeAllListeners();
            if (this.socket.active || this.socket.connected) {
                this.socket.disconnect();
            }
            this.socket = null;
        }
    }

    private becomeLeader(): void {
        if (this.state === SocketState.CONNECTED || this.state === SocketState.CONNECTING) return;
        this.leaderTabId = this.tabId;
        void this.connect();
        if (this.leaderHeartbeatTimer) clearInterval(this.leaderHeartbeatTimer);
        this.leaderHeartbeatTimer = setInterval((): void => {
            this.postBroadcast({ type: 'LEADER_HEARTBEAT', tabId: this.tabId });
        }, LEADER_HEARTBEAT_INTERVAL_MS);
    }

    private resetLeaderCheck(): void {
        if (this.leaderCheckTimer) clearTimeout(this.leaderCheckTimer);
        this.leaderCheckTimer = setTimeout((): void => {
            const safeToPromote = this.state !== SocketState.CONNECTED
                && this.state !== SocketState.CONNECTING
                && this.state !== SocketState.RECONNECTING;
            if (safeToPromote) this.becomeLeader();
        }, LEADER_TIMEOUT_MS);
    }

    private dispatchToLocalListeners(event: S2CName, data: unknown): void {
        switch (event) {
            case 'typingStarted':
                if (isTypingPayload(data)) this.listeners.dispatch('typingStarted', cb => cb(data));
                break;
            case 'typingStopped':
                if (isTypingPayload(data)) this.listeners.dispatch('typingStopped', cb => cb(data));
                break;
            case 'messageRead':
                if (isMessageReadEventPayload(data)) this.listeners.dispatch('messageRead', cb => cb(data));
                break;
            case 'messageDelivered':
                if (isMessageDeliveredPayload(data)) this.listeners.dispatch('messageDelivered', cb => cb(data));
                break;
            case 'messageReceived':
                if (isMessage(data)) this.listeners.dispatch('messageReceived', cb => cb(data));
                break;
            case 'messageDeleted':
                if (isMessageDeletedPayload(data)) this.listeners.dispatch('messageDeleted', cb => cb(data));
                break;
            case 'localMessageDeleted':
                if (isMessageDeletedPayload(data)) this.listeners.dispatch('localMessageDeleted', cb => cb(data));
                break;
            case 'messageReaction':
                if (isMessageReactionPayload(data)) this.listeners.dispatch('messageReaction', cb => cb(data));
                break;
            case 'userStatus':
                if (isUserStatusPayload(data)) this.listeners.dispatch('userStatus', cb => cb(data));
                break;
            case 'notificationNew':
                if (isHaemiNotification(data)) this.listeners.dispatch('notificationNew', cb => cb(data));
                break;
            case 'notificationRead':
                if (isIdPayload(data)) this.listeners.dispatch('notificationRead', cb => cb(data));
                break;
            case 'notificationReadAll':
                this.listeners.dispatch('notificationReadAll', cb => cb());
                break;
            case 'notificationDelete':
                if (isIdPayload(data)) this.listeners.dispatch('notificationDelete', cb => cb(data));
                break;
            case 'reconnect':
                this.listeners.dispatch('reconnect', cb => cb());
                break;
            case 'reconnect_attempt':
                if (typeof data === 'number') this.listeners.dispatch('reconnect_attempt', cb => cb(data));
                break;
            case 'disconnect':
                if (typeof data === 'string') this.listeners.dispatch('disconnect', cb => cb(data));
                break;
            case 'error':
                if (data instanceof Error) this.listeners.dispatch('error', cb => cb(data));
                break;
            case 'connect_error':
                if (data instanceof Error) this.listeners.dispatch('connect_error', cb => cb(data));
                break;
        }
    }

    on<K extends S2CName>(event: K, callback: ServerToClientEvents[K]): void {
        this.listeners.add(event, callback);
        if (!this.socket || this.state === SocketState.FOLLOWER) return;
        // socket.io's `Socket.on` overload union cannot resolve a caller-bound
        // generic K against its distributive listener type. We narrow via a
        // single function-type cast — but the method MUST be bound to its
        // receiver via `Function.prototype.bind` first, otherwise the
        // detached call-site loses its `this` reference and socket.io's
        // internal `Emitter.addEventListener` crashes on `this._callbacks`
        // (the Set it tracks listeners in). `bind` is the documented
        // method-passing pattern; it returns a new function whose `this`
        // is permanently fixed to the socket.
        const bind = this.socket.on.bind(this.socket) as (event: K, listener: ServerToClientEvents[K]) => SocketInstance;
        bind(event, callback);
    }

    off<K extends S2CName>(event: K, callback: ServerToClientEvents[K]): void {
        this.listeners.delete(event, callback);
        if (!this.socket) return;
        const unbind = this.socket.off.bind(this.socket) as (event: K, listener: ServerToClientEvents[K]) => SocketInstance;
        unbind(event, callback);
    }

    emit<K extends C2SName>(event: K, ...args: Parameters<ClientToServerEvents[K]>): void {
        if (this.state === SocketState.FOLLOWER) {
            this.broadcastSocketEmit(event, args);
            return;
        }
        if (this.state !== SocketState.CONNECTED || !this.socket) return;
        const dispatch = this.socket.emit.bind(this.socket) as (event: K, ...args: Parameters<ClientToServerEvents[K]>) => SocketInstance;
        dispatch(event, ...args);
    }

    /**
     * Per-K SOCKET_EMIT broadcast. The generic K-typed envelope is
     * structurally a member of the distributive SocketEmit union, but
     * TypeScript cannot prove that across the boundary. Posting directly
     * via the BroadcastChannel platform API (which is untyped) avoids
     * both lint suppressions and double casts while preserving full
     * compile-time discipline at the call sites of this method.
     */
    private broadcastSocketEmit<K extends C2SName>(
        event: K,
        args: Parameters<ClientToServerEvents[K]>
    ): void {
        if (!this.broadcastChannel) return;
        try {
            this.broadcastChannel.postMessage({ type: 'SOCKET_EMIT', event, args });
        } catch (err: unknown) {
            const detail = err instanceof Error ? err.message : String(err);
            logger.warn('[SocketService] BroadcastChannel post failed', { error: detail, type: 'SOCKET_EMIT' });
        }
    }

    private attachEventPipes(socket: SocketInstance): void {
        const pipe = <K extends S2CName>(event: K, data: unknown): void => {
            if (this.state === SocketState.CONNECTED) {
                this.postBroadcast({ type: 'SOCKET_EVENT', event, data });
            }
            this.dispatchToLocalListeners(event, data);
        };

        socket.on('typingStarted', (data) => pipe('typingStarted', data));
        socket.on('typingStopped', (data) => pipe('typingStopped', data));
        socket.on('messageRead', (data) => pipe('messageRead', data));
        socket.on('messageDelivered', (data) => pipe('messageDelivered', data));
        socket.on('messageReceived', (data) => pipe('messageReceived', data));
        socket.on('messageDeleted', (data) => pipe('messageDeleted', data));
        socket.on('messageReaction', (data) => pipe('messageReaction', data));
        socket.on('userStatus', (data) => pipe('userStatus', data));
        socket.on('localMessageDeleted', (data) => pipe('localMessageDeleted', data));
        socket.on('notificationNew', (data) => pipe('notificationNew', data));
        socket.on('notificationRead', (data) => pipe('notificationRead', data));
        socket.on('notificationReadAll', () => pipe('notificationReadAll', undefined));
        socket.on('notificationDelete', (data) => pipe('notificationDelete', data));
        socket.on('reconnect', () => pipe('reconnect', undefined));
        socket.on('reconnect_attempt', (num) => pipe('reconnect_attempt', num));
        socket.on('disconnect', (reason) => pipe('disconnect', reason));
        socket.on('error', (err: Error) => pipe('error', err));
        socket.on('connect_error', (err: Error) => pipe('connect_error', err));
    }

    public isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    public getState(): SocketState {
        return this.state;
    }

    public updateAuthToken(token: string): void {
        logger.info('[SocketService] Updating authentication token');
        if (!this.socket) return;
        this.socket.auth = { token };
        if (this.socket.connected) {
            this.socket.disconnect().connect();
        }
    }

    /**
     * Transient teardown. Closes the active socket but preserves listeners,
     * BroadcastChannel, and leader-election so the singleton can reconnect
     * within the same page lifecycle (e.g., after logout / re-login).
     * Use this for component-level cleanup. Do NOT use `destroy()` from
     * React effect cleanup — that permanently kills cross-tab coordination.
     */
    disconnect(): void {
        this.transitionTo(SocketState.DISCONNECTED, 'manual');
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
    }

    /**
     * Final teardown for full app shutdown. Closes BroadcastChannel,
     * cancels leader election, and clears every listener. The singleton
     * cannot reconnect after this without a fresh page load.
     */
    public destroy(): void {
        logger.info('[SocketService] Destroying instance (final teardown)');
        this.disconnect();
        this.transitionTo(SocketState.TERMINATED, 'destroy');

        if (this.leaderHeartbeatTimer) clearInterval(this.leaderHeartbeatTimer);
        if (this.leaderCheckTimer) clearTimeout(this.leaderCheckTimer);

        if (this.broadcastChannel) {
            try {
                this.broadcastChannel.close();
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                logger.warn('[SocketService] BroadcastChannel close failed', { error: message });
            }
            this.broadcastChannel = null;
        }

        this.listeners.clear();
    }
}

export const socketService = SocketService.getInstance();
export default socketService;
