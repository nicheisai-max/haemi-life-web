import { createContext } from 'react';
import type { 
    Conversation, 
    Message, 
    Attachment, 
    AttachmentDTO, 
    ParticipantMetadata,
    MessageId,
    ConversationId
} from '../types/chat';

export interface ChatContextType {
    conversations: Conversation[];
    activeConversation: Conversation | null;
    messages: Message[];
    loading: boolean;
    isHydrated: boolean;
    /** True while a backwards-pagination request is in flight. */
    isLoadingOlder: boolean;
    /** True if the backend reported additional older messages beyond what is currently loaded. */
    hasMoreOlder: boolean;
    fetchConversations: () => Promise<void>;
    selectConversation: (conversation: Conversation) => void;
    sendMessage: (
        content: string,
        conversationId: ConversationId,
        attachments?: Attachment[],
        replyToId?: string
    ) => Promise<void>;
    startNewConversation: (participantId: string, meta?: ParticipantMetadata) => Promise<void>;

    uploadAttachment: (file: File) => Promise<AttachmentDTO | null>;
    deleteMessage: (messageId: MessageId, forEveryone: boolean) => Promise<void>;
    reactToMessage: (messageId: MessageId, reactionType: string) => Promise<void>;
    markAsRead: (conversationId: ConversationId) => Promise<void>;
    markMessageAsRead: (messageId: MessageId) => Promise<void>;
    /** Load the next batch of older messages above the current oldest. Idempotent while a load is in flight. */
    loadOlderMessages: (conversationId: ConversationId) => Promise<void>;
    user: { id: string; name: string; role: string } | null;
}

export const ChatContext = createContext<ChatContextType | undefined>(undefined);
