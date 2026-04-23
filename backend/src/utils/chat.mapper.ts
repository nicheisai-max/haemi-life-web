/**
 * 🩺 HAEMI LIFE — INSTITUTIONAL CHAT MAPPER (v5.1)
 * Standard: Google/Meta Strict Type Normalization
 * Domain: Clinical Messaging Reliability
 */

import { ChatMessage, UserRole } from '../types/socket.types';
import { DbMessage, DbConversation, ConversationResponse, DbAttachment, DbReaction } from '../types/chat.types';

/**
 * 🧬 ISO GENERIC TIMESTAMP HANDLER
 * Ensures UTC consistency across all clinical events.
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
 * 🛡️ INSTITUTIONAL PRIVACY GUARD (v4.2)
 * Strips absolute filesystem paths from text content.
 */
const sanitizeContent = (content: string | null | undefined): string => {
    if (!content) return '';
    const pathPattern = /[A-Z]:\\[^ \n\r]+|[\\/][^ \n\r]+/gi;
    return content.replace(pathPattern, (match) => {
        if (match.includes('\\') || match.startsWith('/')) {
            const parts = match.replace(/\\/g, '/').split('/');
            return parts[parts.length - 1] || match;
        }
        return match;
    });
};

/**
 * 🩺 HAEMI MESSAGE TRANSFORMER
 * Maps database message objects to strict API response types.
 */
export const mapMessageToResponse = (message: DbMessage): ChatMessage | null => {
    // P0 Guard: Structural Integrity Check
    if (!message || !message.id || !message.conversation_id) return null;

    // Hardened Message Type Mapping
    const typeAlias: Record<string, ChatMessage['messageType']> = {
        'text': 'text',
        'image': 'image',
        'document': 'document'
    };
    const messageType: ChatMessage['messageType'] = typeAlias[message.message_type] || 'text';

    // P1: Attachment Recovery Pipeline
    // Ensures that even if content is null (attachment-only), the message remains valid.
    const attachments = (message.attachments || []).map((att: DbAttachment) => {
        const cleanName = (att.file_name || 'attachment')
            .replace(/\\/g, '/')
            .split('/')
            .pop() || 'attachment';

        return {
            id: att.id,
            url: `/api/files/message/${att.id}`,
            type: att.file_type || 'application/octet-stream',
            size: Number(att.file_size || 0),
            name: cleanName
        };
    });

    return {
        id: message.id,
        conversationId: message.conversation_id,
        senderId: message.sender_id,
        senderName: message.sender_name || 'System',
        senderRole: (message.sender_role as UserRole) || 'system',
        content: message.is_deleted ? 'This message was deleted' : sanitizeContent(message.content),
        messageType,
        status: (message.status as ChatMessage['status']) || 'sent',
        isRead: Boolean(message.is_read || message.status === 'read'),
        deliveredAt: message.delivered_at ? toIsoString(message.delivered_at) : undefined,
        readAt: message.read_at ? toIsoString(message.read_at) : undefined,
        createdAt: toIsoString(message.created_at),
        replyToId: message.reply_to_id,
        replyTo: message.reply_to ? {
            id: message.reply_to.id,
            content: message.reply_to.content,
            senderName: message.reply_to.sender_name,
        } : null,
        attachments,
        reactions: (message.reactions || []).map((rx: DbReaction) => ({
            type: rx.reaction_type,
            userId: rx.user_id
        })),
        sequenceNumber: Number(message.sequence_number || 0)
    };
};

/**
 * 🩺 HAEMI CONVERSATION TRANSFORMER
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
        participants: (conversation.participants || []),
        participantsHash: conversation.participants_hash,
        unreadCount: Number(conversation.unread_count || 0),
        messageCount: Number(conversation.message_count || 0),
        sequenceCounter: Number(conversation.sequence_counter || 0)
    };
};
