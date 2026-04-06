import { Socket } from 'socket.io';
import { JWTPayload } from './express';

export interface SignalData {
    type?: 'offer' | 'answer' | 'pranswer' | 'rollback';
    sdp?: string;
    candidate?: Record<string, unknown>;
}

export interface ChatMessage {
    id: string;
    conversationId: string;
    senderId: string;
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
    replyToId?: string;
    replyTo?: {
        id: string;
        content: string;
        senderName: string;
    } | null;
    reactions?: Array<{
        type: string;
        userId: string;
    }>;
}

export interface HaemiNotification {
    id: string;
    userId: string;
    title: string;
    description: string;
    type: 'success' | 'info' | 'warning' | 'error';
    createdAt: string;
    isRead: boolean;
    messageId?: string;
    conversationId?: string;
    metadata?: Record<string, unknown>;
    receivedAt?: string;
}

export type UserRole = 'patient' | 'doctor' | 'pharmacist' | 'admin';

/* ---------------- PAYLOAD TYPES ---------------- */

export interface MessageReactionPayload {
    messageId: string;
    userId: string;
    reactionType: string;
    action: 'added' | 'removed';
}

export interface MessageDeletedPayload {
    messageId: string;
    conversationId: string;
}

export interface TypingStartedPayload {
    userId: string;
    conversationId: string;
}

export interface MessageDeliveredPayload {
    conversationId: string;
    messageIds: string[];
}

export interface MessageReadPayload {
    conversationId: string;
    userId: string;
}

export interface JoinConsultationPayload {
    appointmentId: string;
}

export interface CallUserPayload {
    offer: SignalData;
    to: string;
}

export interface MakeAnswerPayload {
    answer: SignalData;
    to: string;
}

export interface IceCandidatePayload {
    candidate: SignalData;
    to: string;
}

export interface AckDeliveryPayload {
    senderId: string;
    senderRole: UserRole;
    conversationId: string;
    messageId: string;
}

export interface TypingStartedPushPayload {
    conversationId: string;
    name: string;
}

export interface UserPresencePayload {
    userId: string;
    status: 'online' | 'offline';
    lastActivity: string; // FIXED: renamed from last_activity (camelCase standard)
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

export type { 
    SessionMetadata, 
    SessionStartedEvent, 
    SessionEndedEvent, 
    LoginEvent, 
    TokenRefreshedEvent,
    ObservabilityBatch
};

/* ---------------- EVENT INTERFACES ---------------- */

export interface MessageReadEvent {
    conversationId: string;
    messageId: string;
    userId: string;
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
    participantJoined: (participantId: string) => void;
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
    typingStarted: (data: { userId: string; conversationId: string; name: string }) => void;
    typingStopped: (data: { userId: string; conversationId: string; name: string }) => void;
    
    // Notification Sync
    notificationNew: (notification: HaemiNotification) => void; 
    notificationRead: (data: { id: string }) => void;
    notificationDelete: (data: { id: string; messageId?: string }) => void;
    notificationReadAll: () => void;

    userStatus: (data: UserPresencePayload) => void;
    observabilityBatch: (data: ObservabilityBatch) => void;
    localMessageDeleted: (data: MessageDeletedPayload) => void;

    // The Governor: Observability Mirroring
    adminMirrorEvent: (payload: AdminMirrorPayload) => void;
}

export interface ClientToServerEvents {
    joinConsultation: (appointmentId: string) => void;
    callUser: (data: CallUserPayload) => void;
    makeAnswer: (data: MakeAnswerPayload) => void;
    iceCandidate: (data: IceCandidatePayload) => void;
    ackDelivery: (data: AckDeliveryPayload) => void;
    joinConversation: (conversationId: string) => void;
    messageRead: (data: MessageReadEvent) => void; 
    typingStarted: (data: TypingStartedPushPayload) => void;
    typingStopped: (data: TypingStartedPushPayload) => void;
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
