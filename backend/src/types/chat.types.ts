export interface ChatParticipant {
    id: string;
    name: string;
    role: string;
    initials: string;
    profileImage: string | null;
}

export interface DbAttachment {
    id: string;
    message_id: string;
    file_path: string;
    file_type: string;
    file_size: number | string;
    file_name: string;
    file_extension: string | null;
    file_category: string | null;
    created_at: Date | string;
}

export interface DbReaction {
    message_id: string;
    reaction_type: string;
    userId: string; // From SQL alias: user_id as "userId"
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
    temp_id?: string;
    preview_text?: string;
    sequence_number?: number | string;
    delivered_at?: string | Date | null;
    read_at?: string | Date | null;
    created_at: string | Date;
    updated_at?: string | Date;
    reply_to_id?: string;
    reply_to?: {
        id: string;
        content: string;
        sender_name: string;
    };
    attachments?: DbAttachment[];
    reactions?: DbReaction[];
}

export interface DbConversation {
    id: string;
    name?: string;
    updated_at: Date | string;
    last_message_at: Date | string;
    last_message?: string;
    last_message_id?: string;
    participants?: ChatParticipant[];
    unread_count: number | string;
    message_count: number | string;
    sequence_counter: number | string;
    participants_hash?: string;
}

export interface ConversationResponse {
    id: string;
    name?: string;
    updatedAt: string;
    lastMessageAt: string;
    lastMessage?: string | null;
    lastMessageId?: string | null;
    participants: ChatParticipant[];
    unreadCount: number;
    messageCount: number;
    sequenceCounter: number;
}
