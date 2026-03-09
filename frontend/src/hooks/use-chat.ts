import { useContext } from 'react';
import { ChatContext, type ChatContextType } from '../context/chat-context';

export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    message_type: 'text' | 'file';
    attachments?: { url: string; type: string; size: number; name?: string }[];
    is_read: boolean;
    status: 'sent' | 'delivered' | 'read';
    delivered_at?: string;
    read_at?: string;
    created_at: string;
    sender_name?: string;
    isMe?: boolean;
    reactions?: { type: string; userId: string }[];
    reply_to?: { id: string; content: string; sender_name: string };
    reply_to_id?: string;
    sequence_number?: string | number;
}

export interface Conversation {
    id: string;
    updated_at: string;
    last_message_at: string;
    last_message?: string;
    participants: { id: string; name: string; role: string; profile_image?: string }[];
    unread_count: string;
    message_count?: string;
    sequence_counter?: string | number;
}

export const useChat = (): ChatContextType => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};
