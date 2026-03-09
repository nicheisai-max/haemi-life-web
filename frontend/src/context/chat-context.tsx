import { createContext } from 'react';
import type { Conversation, Message } from '../hooks/use-chat';

export interface ChatContextType {
    conversations: Conversation[];
    activeConversation: Conversation | null;
    messages: Message[];
    loading: boolean;
    typingUsers: string[];
    fetchConversations: () => Promise<void>;
    selectConversation: (conversation: Conversation) => void;
    sendMessage: (content: string, conversationId: string, attachmentUrl?: string, attachmentType?: string, replyToId?: string) => Promise<void>;
    startNewConversation: (participantId: string) => Promise<void>;
    emitTyping: (conversationId: string, isTyping: boolean) => void;
    uploadAttachment: (file: File) => Promise<{ url: string; type: string } | null>;
    deleteMessage: (messageId: string, forEveryone: boolean) => Promise<void>;
    reactToMessage: (messageId: string, reactionType: string) => Promise<void>;
    markAsRead: (conversationId: string) => Promise<void>;
    user: { id: string; name: string; role: string } | null;
}

export const ChatContext = createContext<ChatContextType | undefined>(undefined);
