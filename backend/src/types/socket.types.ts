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
    forEveryone: boolean;
}

export interface TypingStartedPayload {
    userId: string;
    conversationId: string;
    name: string;
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
    isOnline: boolean;
    lastSeen: string;
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

export interface ServerToClientEvents {
    // Standard Events
    "connect": () => void;
    "disconnect": (reason: string) => void;
    "connect_error": (err: Error) => void;
    "reconnect_attempt": (attempt: number) => void;
    "reconnect_failed": () => void;
    "reconnect": () => void;

    // Video Consultation Events
    "participant-joined": (participantId: string) => void;
    "call-made": (data: { offer: SignalData; socket: string }) => void;
    "answer-made": (data: { answer: SignalData; socket: string }) => void;
    "ice-candidate": (data: { candidate: SignalData; socket: string }) => void;

    // Chat Events
    "messageReaction": (data: MessageReactionPayload) => void;
    "message:deleted": (data: { messageId: string; conversationId: string; forEveryone: boolean }) => void;
    "messageReceived": (message: ChatMessage) => void; 
    "messageDelivered": (data: MessageDeliveredPayload) => void;
    "message:read": (data: MessageReadEvent) => void; 
    "ackDelivery": (data: AckDeliveryPayload) => void;
    "typingStarted": (data: TypingStartedPayload) => void;
    "typingStopped": (data: TypingStartedPayload) => void;
    "notification:new": (notification: HaemiNotification) => void; 
    "userStatus": (data: UserPresencePayload) => void;
    "observabilityBatch": (data: ObservabilityBatch) => void;
}

export interface ClientToServerEvents {
    "join-consultation": (appointmentId: string) => void;
    "call-user": (data: CallUserPayload) => void;
    "make-answer": (data: MakeAnswerPayload) => void;
    "ice-candidate": (data: IceCandidatePayload) => void;
    "ackDelivery": (data: AckDeliveryPayload) => void;
    "joinConversation": (conversationId: string) => void;
    "message:read": (data: MessageReadEvent) => void; // New client emission
    "typingStarted": (data: TypingStartedPushPayload) => void;
    "typingStopped": (data: TypingStartedPushPayload) => void;
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
