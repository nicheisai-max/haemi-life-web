import { createContext } from 'react';
import { PresenceRecord, UserId, ConversationId } from '../types/chat';

export interface PresenceContextType {
    presence: Record<UserId, PresenceRecord>;
    typingUsers: UserId[];
    fetchPresence: (userIds: UserId[]) => Promise<void>;
    emitTyping: (conversationId: ConversationId, isTyping: boolean) => void;
}

export const PresenceContext = createContext<PresenceContextType | undefined>(undefined);
