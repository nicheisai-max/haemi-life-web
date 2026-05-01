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
    // P1 CASING FIX (Phase 12): camelCase across the API/socket boundary.
    lastActivity: string;
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
    /**
     * Decrypted content of the original message being replied to.
     */
    content: string;
    /**
     * Display name of the original message's sender. Nullable because
     * the backend resolves it via `LEFT JOIN users u ON m.sender_id = u.id`
     * — if the original sender's account was subsequently deleted (or the
     * row is missing for any reason), the JOIN yields NULL. Consumers
     * must render a fallback like "Unknown sender" rather than letting
     * the raw `null` bleed into the DOM.
     */
    senderName: string | null;
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
/**
 * The four canonical actor roles in the platform. Mirrors the backend
 * `UserRole` declared in `backend/src/types/socket.types.ts` and the
 * `users.role` ENUM in the database — kept in lock-step with the
 * server's domain so role-aware UI (clinical-priority styling, doctor
 * badges, etc.) can branch on a closed set rather than a free string.
 */
export type SenderRole = 'patient' | 'doctor' | 'pharmacist' | 'admin' | 'system';

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
    /**
     * The sender's role at the time of send. Backend already emits this
     * on every chat socket frame and includes it in the REST mapper
     * output; previously the frontend dropped the field at the type
     * boundary, silently discarding wire data. Captured here so future
     * UI affordances (role badges in the bubble, clinician-priority
     * styling) can use a typed value without re-fetching the user.
     */
    senderRole?: SenderRole;
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
