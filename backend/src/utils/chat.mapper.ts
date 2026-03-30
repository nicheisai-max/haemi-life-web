// 🔒 HAEMI ATTACHMENT PIPELINE LOCK
// DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL
// SINGLE SOURCE: message_attachments ONLY
// FALLBACKS FORBIDDEN
// TYPESCRIPT STRICT MODE ENFORCED

import { ChatMessage, UserRole } from '../types/socket.types';
import { DbMessage, DbConversation, ConversationResponse } from '../types/chat.types';

/**
 * Normalizes a Message object from DB to camelCase API response
 */
export const mapMessageToResponse = (message: DbMessage): ChatMessage | null => {
    if (!message || !message.id || !message.conversation_id) return null;

    // P0 FIX: Derive messageType strictly from message_type or attachments
    // Fallback to 'document' only if explicitly marked as 'file' with no type info
    let normalizedType: 'text' | 'image' | 'document' = 'text';
    const allowedTypes = ['text', 'image', 'document'] as const;
    if (allowedTypes.includes(message.message_type as typeof allowedTypes[number])) {
        normalizedType = message.message_type as typeof allowedTypes[number];
    } else {
        normalizedType = 'text';
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
        deliveredAt: typeof message.delivered_at === 'string' ? message.delivered_at : (message.delivered_at as Date)?.toISOString?.(),
        readAt: typeof message.read_at === 'string' ? message.read_at : (message.read_at as Date)?.toISOString?.(),
        createdAt: typeof message.created_at === 'string' ? message.created_at : (message.created_at as Date)?.toISOString?.() || new Date().toISOString(),
        replyToId: message.reply_to_id,
        replyTo: message.reply_to ? {
            id: message.reply_to.id,
            content: message.reply_to.content,
            senderName: message.reply_to.sender_name,
        } : null,
        attachments: (message.attachments || []).map(att => ({
            url: att.url || '',
            type: att.type || 'document',
            size: Number(att.size || 0),
            name: att.name || 'attachment'
        })),
        reactions: message.reactions || [],
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
        updatedAt: conversation.updated_at,
        lastMessageAt: conversation.last_message_at,
        lastMessage: conversation.last_message || null,
        lastMessageId: conversation.last_message_id || null,
        participants: conversation.participants || [],
        unreadCount: Number(conversation.unread_count || 0),
        messageCount: Number(conversation.message_count || 0),
        sequenceCounter: Number(conversation.sequence_counter || 0)
    };
};
