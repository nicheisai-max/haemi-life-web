/**
 * Haemi Chat: Institutional Type System (v5.0)
 * Hardened with Branded Types (Google/Meta Grade)
 */

// 🔒 BRANDED PRIMITIVES: Prevent ID type mixups at compile time
export type UserId = string & { readonly __brand: unique symbol };
export type MessageId = string & { readonly __brand: unique symbol };
export type ConversationId = string & { readonly __brand: unique symbol };

export interface ChatParticipant {
    id: UserId;
    name: string;
    role: string;
    initials: string;
    profileImage: string | null;
}

export interface DbAttachment {
    id: string; // Internal UUID
    message_id: MessageId;
    file_path: string;
    file_type: string;
    file_size: number | string;
    file_name: string;
    file_extension: string | null;
    file_category: string | null;
    created_at: Date | string;
}

export interface DbReaction {
    message_id: MessageId;
    reaction_type: string;
    user_id: UserId; // Forensic Correction: Symmetry with DB schema
}

export interface DbMessage {
    id: MessageId;
    conversation_id: ConversationId;
    sender_id: UserId;
    sender_name: string;
    sender_role: string;
    content: string;
    message_type: string;
    status: string;
    is_read: boolean;
    is_deleted?: boolean;
    deleted_at?: string | Date | null;
    temp_id?: string;
    preview_text?: string;
    sequence_number?: number | string;
    delivered_at?: string | Date | null;
    read_at?: string | Date | null;
    created_at: string | Date;
    updated_at?: string | Date;
    reply_to_id?: MessageId;
    reply_to?: {
        id: MessageId;
        content: string;
        sender_name: string;
    };
    attachments?: DbAttachment[];
    reactions?: DbReaction[];
}

export interface DbConversation {
    id: ConversationId;
    name?: string;
    updated_at: Date | string;
    last_message_at: Date | string;
    last_message?: string;
    last_message_id?: MessageId;
    participants?: ChatParticipant[];
    unread_count: number | string;
    message_count: number | string;
    sequence_counter: number | string;
    participants_hash: string;
}

export interface ConversationResponse {
    id: ConversationId;
    name?: string;
    updatedAt: string;
    lastMessageAt: string;
    lastMessage?: string | null;
    lastMessageId?: MessageId | null;
    participants: ChatParticipant[];
    participantsHash: string;
    unreadCount: number;
    messageCount: number;
    sequenceCounter: number;
}

// ─── REQUEST INTERFACES (Institutional Grade) ───────────────────────────────

export interface SendMessageRequest {
    participantId?: UserId;
    conversationId?: ConversationId;
    content: string;
    messageType?: 'text' | 'image' | 'document';
    attachment?: {
        url: string;
        type: string;
        originalName: string;
    };
    tempId?: string;
    attachments?: {
        url: string;
        type: string;
        originalName: string;
    }[];
    replyToId?: MessageId;
}

export interface StartConversationRequest {
    participantId: UserId;
}

export interface ReactToMessageRequest {
    reactionType: string;
}

export interface DeleteMessageRequest {
    forEveryone: boolean;
}
