import { createContext } from 'react';
import type { 
    Conversation, 
    Message, 
    Attachment, 
    AttachmentDTO, 
    PresenceRecord, 
    ParticipantMetadata,
    UserId,
    MessageId,
    ConversationId
} from '../types/chat';

export interface ChatContextType {
    conversations: Conversation[];
    activeConversation: Conversation | null;
    messages: Message[];
    loading: boolean;
    typingUsers: UserId[];
    presence: Record<UserId, PresenceRecord>;
    fetchConversations: () => Promise<void>;
    selectConversation: (conversation: Conversation) => void;
    sendMessage: (
        content: string, 
        conversationId: ConversationId, 
        attachments?: Attachment[],
        replyToId?: string
    ) => Promise<void>;
    startNewConversation: (participantId: string, meta?: ParticipantMetadata) => Promise<void>;
    emitTyping: (conversationId: ConversationId, isTyping: boolean) => void;
    uploadAttachment: (file: File) => Promise<AttachmentDTO | null>;
    deleteMessage: (messageId: MessageId, forEveryone: boolean) => Promise<void>;
    reactToMessage: (messageId: MessageId, reactionType: string) => Promise<void>;
    markAsRead: (conversationId: ConversationId) => Promise<void>;
    markMessageAsRead: (messageId: MessageId) => Promise<void>;
    user: { id: string; name: string; role: string } | null;
}

export const ChatContext = createContext<ChatContextType | undefined>(undefined);
