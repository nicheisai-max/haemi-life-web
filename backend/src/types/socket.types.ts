import { Socket } from 'socket.io';
import { JWTPayload } from './express';

export interface SignalData {
    type?: 'offer' | 'answer' | 'pranswer' | 'rollback';
    sdp?: string;
    candidate?: Record<string, unknown>;
}

export interface ChatMessage {
    id: string;
    conversation_id: string;
    sender_id: string;
    sender_role?: UserRole;
    content: string;
    message_type: 'text' | 'file';
    created_at: string;
    status: 'sent' | 'delivered' | 'read';
    is_read: boolean;
    sequence_number?: number;
    attachment?: {
        url: string;
        type: string;
    } | null;
    reply_to?: {
        id: string;
        content: string;
        sender_id: string;
    } | null;
    reactions?: Array<{
        type: string;
        userId: string;
    }>;
}

export interface HaemiNotification {
    id: string;
    user_id: string;
    title: string;
    description: string;
    type: 'success' | 'info' | 'warning' | 'error';
    created_at: string;
    is_read: boolean;
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
    userId?: string;
    conversationId?: string;
    name?: string;
}

export interface MessageDeliveredPayload {
    conversationId: string;
    messageIds: string[];
}

export interface MessageReadPayload {
    conversationId: string;
    user_id: string;
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
    sender_id: string;
    sender_role: UserRole;
    conversationId: string;
    messageId: string;
}

export interface TypingStartedPushPayload {
    conversationId: string;
    name: string;
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
    "message_reaction": (data: MessageReactionPayload) => void;
    "message_deleted": (data: MessageDeletedPayload) => void;
    "message_received": (message: ChatMessage) => void; 
    "message_delivered": (data: MessageDeliveredPayload) => void;
    "message_read": (data: MessageReadPayload) => void;
    "ack_delivery": (data: AckDeliveryPayload) => void;
    "typing_started": (data: { userId: string } | { conversationId: string; name: string }) => void;
    "typing_stopped": (data: { userId: string } | { conversationId: string; name: string }) => void;
    "notification:new": (notification: HaemiNotification) => void; 

    // Admin Observability Events
    "session_started": (data: SessionStartedEvent) => void;
    "session_ended": (data: SessionEndedEvent) => void;
    "login_success": (data: LoginEvent) => void;
    "login_failure": (data: LoginEvent) => void;
    "token_refreshed": (data: TokenRefreshedEvent) => void;
    "observability_batch": (data: ObservabilityBatch) => void;
}

export interface ClientToServerEvents {
    "join-consultation": (appointmentId: string) => void;
    "call-user": (data: CallUserPayload) => void;
    "make-answer": (data: MakeAnswerPayload) => void;
    "ice-candidate": (data: IceCandidatePayload) => void;
    "ack_delivery": (data: AckDeliveryPayload) => void;
    "join_conversation": (conversationId: string) => void;
    "ack_read": (data: MessageReadPayload) => void;
    "typing_started": (data: TypingStartedPushPayload) => void;
    "typing_stopped": (data: TypingStartedPushPayload) => void;
}

export interface InterServerEvents {
    ping: () => void;
}

export interface SocketData {
    user: JWTPayload & { role: UserRole };
}

export type StrictAuthenticatedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
