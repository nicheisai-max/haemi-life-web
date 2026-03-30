import { useContext } from 'react';
import { ChatContext, type ChatContextType } from '../context/chat-context';

export interface ChatParticipant {
    id: string;
    name: string;
    role: string;
    profileImage?: string;
    initials?: string;
}

export interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    messageType: 'text' | 'image' | 'document';
    attachments?: { url: string; type: string; size: number; name?: string }[];
    isRead?: boolean;
    status: 'sending' | 'sent' | 'delivered' | 'read';
    deliveredAt?: string;
    readAt?: string;
    createdAt: string;
    senderName?: string;
    isMe?: boolean;
    reactions?: { type: string; userId: string }[];
    replyTo?: { id: string; content: string; senderName: string };
    replyToId?: string;
    sequenceNumber?: number;
}

export interface Conversation {
    id: string;
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

export const useChat = (): ChatContextType => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};
