import { useContext } from 'react';
import { ChatContext, type ChatContextType } from '../context/chat-context';

export * from '../types/chat';

export const useChat = (): ChatContextType => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};
