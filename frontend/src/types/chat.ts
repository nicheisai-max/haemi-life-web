// ============================================================
// HAEMI LIFE — CHAT TYPE SYSTEM (v3.0)
// Institutional-Grade TypeScript Definitions
// Naming Standard: camelCase throughout (snake_case only in DB)
// ============================================================

// --- Presence ---

export interface PresenceRecord {
    isOnline: boolean;
    lastActivity: string; // FIXED: was last_activity (snake_case drift)
}

export interface PresenceApiResponse {
    success?: boolean;
    message?: string;
    data?: Record<string, PresenceRecord>;
}

// --- Attachments ---

/** Raw DTO from the API/Socket layer before normalization */
export interface AttachmentDTO {
    url: string;
    tempId: string | number;
    type: string;
    originalName: string;
    size: number;
    name: string;
}

/** Normalized attachment used inside the frontend Message model */
export interface Attachment {
    url: string;
    type: string;
    name: string;
    size: number;
}

// --- Reactions ---

export interface MessageReaction {
    type: string;
    userId: string;
}

// --- Reply Preview ---

export interface ReplyPreview {
    id: string;
    content: string;
    senderName: string;
}

// --- Participants ---

export interface ChatParticipant {
    id: string;       // Always string. Normalize at the boundary (mapper/provider).
    name: string;
    role: string;
    profileImage?: string | null;
    initials?: string;
}

// --- Messages ---

export type MessageType = 'text' | 'image' | 'document';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
    id: string;
    conversationId: string;
    senderId: string;
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
    replyToId?: string;
    sequenceNumber?: number;
}

// --- Conversations ---

export interface Conversation {
    id: string;
    isDraft?: boolean;
    name?: string;
    updatedAt: string;
    lastMessageAt: string;
    lastMessage: string;
    lastMessageId: string;
    participants: ChatParticipant[];
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
        id: String(p.id),
        name: p.name,
        role: p.role,
        profileImage: p.profileImage ?? p.profile_image ?? null,
        initials: p.initials ?? '',
    };
}
