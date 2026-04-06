import { ChatMessage, UserRole } from '../types/socket.types';
import { DbMessage, DbConversation, ConversationResponse, DbAttachment, DbReaction } from '../types/chat.types';

/**
 * Institutional Timestamp Normalization (Military Grade)
 * Guaranteed ISO-8601 UTC output from any Date or String source.
 */
const toIsoString = (val: Date | string | null | undefined): string => {
    if (!val) return new Date().toISOString();
    try {
        const date = val instanceof Date ? val : new Date(val);
        return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    } catch {
        return new Date().toISOString();
    }
};

/**
 * Normalizes a Message object from DB to camelCase API response
 */
export const mapMessageToResponse = (message: DbMessage): ChatMessage | null => {
    if (!message || !message.id || !message.conversation_id) return null;

    // Standardized Message Type Logic
    let normalizedType: 'text' | 'image' | 'document' = 'text';
    const allowedTypes = ['text', 'image', 'document'] as const;
    if (allowedTypes.includes(message.message_type as typeof allowedTypes[number])) {
        normalizedType = message.message_type as typeof allowedTypes[number];
    }

    return {
        id: message.id,
        conversationId: message.conversation_id,
        senderId: message.sender_id,
        senderName: message.sender_name || 'System',
        senderRole: (message.sender_role as UserRole) || 'system', 
        content: message.content,
        messageType: normalizedType,
        status: message.status as ChatMessage['status'],
        isRead: message.is_read || message.status === 'read',
        deliveredAt: message.delivered_at ? toIsoString(message.delivered_at) : undefined,
        readAt: message.read_at ? toIsoString(message.read_at) : undefined,
        createdAt: toIsoString(message.created_at),
        replyToId: message.reply_to_id,
        replyTo: message.reply_to ? {
            id: message.reply_to.id,
            content: message.reply_to.content,
            senderName: message.reply_to.sender_name,
        } : null,
        attachments: (message.attachments || []).map((att: DbAttachment) => ({
            url: `/api/files/message/${att.id}`, // P0 Institutional Fix: Maps physical storage to virtual delivery
            type: att.file_type || 'document',
            size: Number(att.file_size || 0),
            name: att.file_name || 'attachment'
        })),
        reactions: (message.reactions || []).map((rx: DbReaction) => ({
            type: rx.reaction_type,
            userId: rx.userId
        })),
        sequenceNumber: Number(message.sequence_number || 0)
    };
};

/**
 * Normalizes a Conversation object from DB to camelCase API response
 */
export const mapConversationToResponse = (conversation: DbConversation): ConversationResponse | null => {
    if (!conversation) return null;

    return {
        id: conversation.id,
        name: conversation.name,
        updatedAt: toIsoString(conversation.updated_at),
        lastMessageAt: toIsoString(conversation.last_message_at),
        lastMessage: conversation.last_message || null,
        lastMessageId: conversation.last_message_id || null,
        participants: conversation.participants || [],
        unreadCount: Number(conversation.unread_count || 0),
        messageCount: Number(conversation.message_count || 0),
        sequenceCounter: Number(conversation.sequence_counter || 0)
    };
};
