import { createContext } from 'react';
import type { Conversation, Message, Attachment, AttachmentDTO, PresenceRecord, ParticipantMetadata } from '../types/chat';

export interface ChatContextType {
    conversations: Conversation[];
    activeConversation: Conversation | null;
    messages: Message[];
    loading: boolean;
    typingUsers: string[];
    presence: Record<string, PresenceRecord>;
    fetchConversations: () => Promise<void>;
    selectConversation: (conversation: Conversation) => void;
    sendMessage: (
        content: string, 
        conversationId: string, 
        attachmentUrl?: string, 
        attachmentType?: string, 
        replyToId?: string, 
        attachmentName?: string,
        attachments?: Attachment[]
    ) => Promise<void>;
    startNewConversation: (participantId: string, meta?: ParticipantMetadata) => Promise<void>;
    emitTyping: (conversationId: string, isTyping: boolean) => void;
    uploadAttachment: (file: File) => Promise<AttachmentDTO | null>;
    deleteMessage: (messageId: string, forEveryone: boolean) => Promise<void>;
    reactToMessage: (messageId: string, reactionType: string) => Promise<void>;
    markAsRead: (conversationId: string) => Promise<void>;
    markMessageAsRead: (messageId: string) => Promise<void>;
    user: { id: string; name: string; role: string } | null;
}

export const ChatContext = createContext<ChatContextType | undefined>(undefined);
