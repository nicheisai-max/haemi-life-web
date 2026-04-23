// ============================================================
// HAEMI LIFE — CHAT TYPE SYSTEM (v3.0)
// Institutional-Grade TypeScript Definitions
// Naming Standard: snake_case for DB parity, camelCase for local logic
// ============================================================

/** Branded string types for institutional-grade type safety (Google/Meta Standard) */
export type UserId = string & { readonly __brand: unique symbol };
export type MessageId = string & { readonly __brand: unique symbol };
export type ConversationId = string & { readonly __brand: unique symbol };

// --- Presence ---

export interface PresenceRecord {
    isOnline: boolean;
    last_activity: string;
}

export interface PresenceApiResponse {
    success?: boolean;
    message?: string;
    data?: Record<string, PresenceRecord>;
}

// --- Attachments ---

/** Raw DTO from the API/Socket layer before normalization */
export interface AttachmentDTO {
    id?: string;
    url: string;
    tempId: string | number;
    type: string;
    originalName: string;
    size: number;
    name: string;
}

/** Normalized attachment used inside the frontend Message model */
export interface Attachment {
    id?: string; // Institutional UUID SSOT (Optional for optimistic states)
    url: string;
    type: string;
    name: string;
    size: number;
}

// --- Reactions ---

export interface MessageReaction {
    type: string;
    userId: UserId;
}

// --- Reply Preview ---

export interface ReplyPreview {
    id: MessageId;
    content: string;
    senderName: string;
}

// --- Participants ---

export interface ChatParticipant {
    id: UserId;       // Institutional Branded Type
    name: string;
    role: string;
    profileImage?: string | null;
    initials?: string;
}

/** Explicit metadata handover for starting new conversations (Google/Meta Standard) */
export interface ParticipantMetadata {
    name: string;
    specialization: string;
    profileImage?: string | null;
}

// --- Messages ---

export type MessageType = 'text' | 'image' | 'document';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
    id: MessageId;
    conversationId: ConversationId;
    senderId: UserId;
    tempId?: string;
    content: string;
    messageType: MessageType;
    attachments?: Attachment[];
    isRead?: boolean;
    status: MessageStatus;
    deliveredAt?: string;
    readAt?: string;
    createdAt: string;
    senderName?: string;
    isMe?: boolean;
    reactions?: MessageReaction[];
    replyTo?: ReplyPreview;
    replyToId?: MessageId;
    sequenceNumber?: number;
}

// --- Conversations ---

export interface Conversation {
    id: ConversationId;
    isDraft?: boolean;
    name?: string;
    updatedAt: string;
    lastMessageAt: string;
    lastMessage?: string; // Optional: undefined when all messages deleted (last_message_id = NULL in DB)
    lastMessageId: MessageId;
    participants: ChatParticipant[];
    participantsHash: string;
    unreadCount: number;
    messageCount: number;
    sequenceCounter: number;
}

// --- Generic API Envelope ---

export interface ChatApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
    statusCode: number;
}

// --- Participant Normalizer (inline mapper) ---
// Used at the API boundary to normalize snake_case from backend

export interface RawParticipant {
    id: string | number;
    name: string;
    role: string;
    profileImage?: string | null;
    profile_image?: string | null; // backend snake_case variant
    initials?: string;
}

export function normalizeParticipant(p: RawParticipant): ChatParticipant {
    return {
        id: String(p.id) as UserId,
        name: p.name,
        role: p.role,
        profileImage: p.profileImage ?? p.profile_image ?? null,
        initials: p.initials ?? '',
    };
}

export interface MessageReadEvent {
    conversationId: ConversationId;
    messageIds: MessageId[];
    userId: UserId;
}
