export interface ChatParticipant {
    id: string;
    name: string;
    role: string;
    initials: string;
    profileImage: string | null;
}

export interface DbMessage {
    id: string;
    conversation_id: string;
    sender_id: string;
    sender_name: string;
    sender_role: string;
    content: string;
    message_type: string;
    status: string;
    is_read: boolean;
    preview_text?: string;
    sequence_number?: number | string;
    delivered_at?: string | Date;
    read_at?: string | Date;
    created_at: string | Date;
    reply_to_id?: string;
    reply_to?: {
        id: string;
        content: string;
        sender_name: string;
    };
    attachment_url?: string;
    attachment_name?: string;
    attachment_type?: string;
    attachments?: Array<{ url: string; type: string; size: number; name?: string }>;
    reactions?: Array<{ type: string; userId: string }>;
    sequence_number_int?: number;
}

export interface DbConversation {
    id: string;
    name?: string;
    updated_at: Date | string;
    last_message_at: Date | string;
    last_message?: string;
    last_message_id?: string;
    participants?: ChatParticipant[];
    unread_count: number;
    message_count: number;
    sequence_counter: number;
    participants_hash?: string;
}

export interface ConversationResponse {
    id: string;
    name?: string;
    updatedAt: string | Date;
    lastMessageAt: string | Date;
    lastMessage?: string | null;
    lastMessageId?: string | null;
    participants: ChatParticipant[];
    unreadCount: number;
    messageCount: number;
    sequenceCounter: number;
}
