import { Socket } from 'socket.io';
import { JWTPayload } from './express';
import { UserId, MessageId, ConversationId } from './chat.types';

export interface SignalData {
    type?: 'offer' | 'answer' | 'pranswer' | 'rollback';
    sdp?: string;
    candidate?: Record<string, unknown>;
}

export interface ChatMessage {
    id: MessageId;
    conversationId: ConversationId;
    senderId: UserId;
    tempId?: string;
    senderName?: string;
    senderRole?: UserRole;
    content: string;
    messageType: 'text' | 'image' | 'document';
    createdAt: string;
    deliveredAt?: string;
    readAt?: string;
    status: 'sent' | 'delivered' | 'read';
    isRead: boolean;
    sequenceNumber: number;
    attachments?: Array<{
        url: string;
        type: string;
        size?: number;
        name?: string;
    }>;
    replyToId?: MessageId;
    replyTo?: {
        id: MessageId;
        content: string;
        // `senderName` is nullable because the upstream LEFT JOIN to
        // `users` returns NULL when the original sender's account has
        // been deleted. The frontend must render a fallback ("Unknown
        // sender") rather than treating this as a guaranteed string.
        senderName: string | null;
    } | null;
    reactions?: Array<{
        type: string;
        userId: UserId;
    }>;
}

export interface HaemiNotification {
    id: string;
    userId: UserId;
    title: string;
    description: string;
    type: 'success' | 'info' | 'warning' | 'error';
    createdAt: string;
    isRead: boolean;
    messageId?: MessageId;
    conversationId?: ConversationId;
    metadata?: Record<string, unknown>;
    receivedAt?: string;
}

export type UserRole = 'patient' | 'doctor' | 'pharmacist' | 'admin';

/* ---------------- PAYLOAD TYPES ---------------- */

export interface MessageReactionPayload {
    messageId: MessageId;
    userId: UserId;
    reactionType: string;
    action: 'added' | 'removed';
}

export interface MessageDeletedPayload {
    messageId: MessageId;
    conversationId: ConversationId;
    newLastMessage?: {
        id: MessageId;
        content: string;
        createdAt: string;
    } | null;
}

export interface TypingEventPayload {
    userId: UserId;
    conversationId: ConversationId;
    name: string;
}

export interface UserPresencePayload {
    userId: UserId;
    isOnline: boolean; // Institutional standard (boolean)
    // P1 CASING FIX (Phase 12): camelCase across the socket boundary.
    lastActivity: string;
}

export interface MessageDeliveredPayload {
    messageIds: MessageId[]; // UPGRADE: Plural Support
    conversationId: ConversationId;
    userId: UserId;
    timestamp: string;
}

export interface AckDeliveryPayload {
    messageId: MessageId;
    conversationId: ConversationId;
}

export interface TypingStartedPushPayload {
    conversationId: ConversationId;
}

export interface CallUserPayload {
    to: string;
    offer: SignalData;
}

export interface MakeAnswerPayload {
    to: string;
    answer: SignalData;
}

export interface IceCandidatePayload {
    to: string;
    candidate: SignalData;
}

/* ---------------- OBSERVABILITY PAYLOADS ---------------- */

import {
    SessionMetadata,
    SessionStartedEvent,
    SessionEndedEvent,
    LoginEvent,
    TokenRefreshedEvent,
    ObservabilityBatch
} from '../../../shared/schemas/observability.schema';

import {
    ScreeningReorderedEvent,
} from '../../../shared/schemas/admin-events.schema';

export type {
    SessionMetadata,
    SessionStartedEvent,
    SessionEndedEvent,
    LoginEvent,
    TokenRefreshedEvent,
    ObservabilityBatch,
    ScreeningReorderedEvent,
};

/* ---------------- EVENT INTERFACES ---------------- */

export interface MessageReadEvent {
    conversationId: ConversationId;
    messageIds: MessageId[]; // UPGRADE: Plural Support (Institutional Batching)
    userId: UserId;
}

export interface AdminMirrorPayload {
    event: string;
    data: unknown; // FIXED: replaced `any` with `unknown` for type safety
    timestamp: string;
}

export interface ServerToClientEvents {
    // Standard Events
    "connect": () => void;
    "disconnect": (reason: string) => void;
    "connect_error": (err: Error) => void;
    "reconnect_attempt": (attempt: number) => void;
    "reconnect_failed": () => void;
    "reconnect": () => void;

    // Video Consultation Events
    participantJoined: (participantId: UserId) => void;
    callMade: (data: { offer: SignalData; socket: string }) => void;
    answerMade: (data: { answer: SignalData; socket: string }) => void;
    iceCandidate: (data: { candidate: SignalData; socket: string }) => void;

    // Chat & Notification Events
    messageReaction: (data: MessageReactionPayload) => void;
    messageDeleted: (data: MessageDeletedPayload) => void;
    messageReceived: (message: ChatMessage) => void;
    messageDelivered: (data: MessageDeliveredPayload) => void;
    messageRead: (data: MessageReadEvent) => void;
    ackDelivery: (data: AckDeliveryPayload) => void;
    typingStarted: (data: { userId: UserId; conversationId: ConversationId; name: string }) => void;
    typingStopped: (data: { userId: UserId; conversationId: ConversationId; name: string }) => void;

    // Notification Sync
    notificationNew: (notification: HaemiNotification) => void;
    notificationRead: (data: { id: string }) => void;
    notificationDelete: (data: { id: string; messageId?: MessageId }) => void;
    notificationReadAll: () => void;

    userStatus: (data: UserPresencePayload) => void;
    observabilityBatch: (data: ObservabilityBatch) => void;
    localMessageDeleted: (data: MessageDeletedPayload) => void;

    // The Governor: Observability Mirroring
    adminMirrorEvent: (payload: AdminMirrorPayload) => void;

    // ─── Admin observability events (typed contract — see
    //     shared/schemas/admin-events.schema.ts for the full vocabulary
    //     and emit-side validation logic in services/admin-broadcast.service.ts).
    //     Each event listed here MUST have a matching Zod schema in the
    //     shared schema map so the wire payload is validated at both ends.
    'screening:reordered': (payload: ScreeningReorderedEvent) => void;
}

export interface ClientToServerEvents {
    joinConsultation: (appointmentId: string) => void;
    callUser: (data: CallUserPayload) => void;
    makeAnswer: (data: MakeAnswerPayload) => void;
    iceCandidate: (data: IceCandidatePayload) => void;
    ackDelivery: (data: AckDeliveryPayload) => void;
    joinConversation: (conversationId: ConversationId) => void;
    messageRead: (data: MessageReadEvent) => void;
    typingStarted: (data: TypingStartedPushPayload) => void;
    typingStopped: (data: TypingStartedPushPayload) => void;
    heartbeat: () => void;
}

export interface InterServerEvents {
    ping: () => void;
}

export interface SocketData {
    user: JWTPayload & { role: UserRole };
}

export type StrictAuthenticatedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

import { Server as SocketIOServer } from 'socket.io';
export type HaemiServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
