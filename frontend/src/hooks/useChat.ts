import { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'; // Adjust for production

export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    message_type: 'text' | 'file';
    attachments?: { url: string; type: string; size: number }[];
    is_read: boolean;
    created_at: string;
    sender_name?: string;
    isMe?: boolean;
    reactions?: { type: string; userId: string }[];
    reply_to?: { id: string; content: string; sender_name: string };
    reply_to_id?: string;
}

export interface Conversation {
    id: string;
    updated_at: string;
    last_message_at: string;
    last_message?: string;
    participants: { id: string; name: string; role: string; profile_image?: string }[];
    unread_count: string;
}

export const useChat = () => {
    const { user, token } = useAuth();
    const [socket, setSocket] = useState<any>(null); // Use any for socket to bypass strict constructor matching in dev
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);

    // Load Conversations
    const fetchConversations = useCallback(async () => {
        try {
            const res = await api.get('/chat/conversations');
            setConversations(res.data);
        } catch (error) {
            console.error('Failed to fetch conversations', error);
        }
    }, []);

    // Load Messages
    const loadMessages = useCallback(async (conversationId: string) => {
        setLoading(true);
        try {
            const res = await api.get(`/chat/messages/${conversationId}`);
            const formattedMessages = res.data.map((msg: any) => ({
                ...msg,
                isMe: msg.sender_id === user?.id
            }));
            setMessages(formattedMessages);

            // Mark as read
            await api.put(`/chat/conversations/${conversationId}/read`);
            fetchConversations(); // Update unread count
        } catch (error) {
            console.error('Failed to load messages', error);
        } finally {
            setLoading(false);
        }
    }, [user, fetchConversations]);

    // Determine current conversation ID for socket checks
    // We use a ref or just dependency on activeConversation in effect
    // But socket `receive_message` closure needs latest state.
    // simpler to rely on checking payload or state updater.

    useEffect(() => {
        if (user && token) {
            const newSocket = io(SOCKET_URL, { auth: { token } });

            newSocket.on('connect', () => console.log('Chat socket connected'));

            // Real-time Reaction Handler
            newSocket.on('message_reaction', ({ messageId, userId, reactionType, action }: any) => {
                setMessages(prev => prev.map(msg => {
                    if (msg.id === messageId) {
                        const reactions = msg.reactions || [];
                        if (action === 'added') {
                            const filtered = reactions.filter(r => r.userId !== userId);
                            return { ...msg, reactions: [...filtered, { type: reactionType, userId }] };
                        } else {
                            return { ...msg, reactions: reactions.filter(r => !(r.userId === userId && r.type === reactionType)) };
                        }
                    }
                    return msg;
                }));
            });

            // Real-time Deletion Handler
            newSocket.on('message_deleted', ({ messageId, forEveryone }: any) => {
                if (forEveryone) {
                    setMessages(prev => prev.filter(msg => msg.id !== messageId));
                }
            });

            newSocket.on('user_typing', ({ userId, isTyping }: { userId: string, isTyping: boolean }) => {
                if (isTyping) {
                    setTypingUsers((prev: string[]) => [...new Set([...prev, userId])]);
                } else {
                    setTypingUsers((prev: string[]) => prev.filter(id => id !== userId));
                }
            });

            setSocket(newSocket);
            return () => { newSocket.disconnect(); };
        }
    }, [user, token]);

    // Message Receive Handler
    useEffect(() => {
        if (!socket) return;
        const handler = (message: Message) => {
            console.log('Incoming message via socket:', message.id, message.content);
            if (activeConversation && message.conversation_id === activeConversation.id) {
                setMessages((prev: Message[]) => {
                    const isDuplicate = prev.some(m => String(m.id) === String(message.id));
                    if (isDuplicate) {
                        console.warn('Duplicate message ignored:', message.id);
                        return prev;
                    }
                    return [...prev, { ...message, isMe: message.sender_id === user?.id }];
                });
                api.put(`/chat/conversations/${activeConversation.id}/read`).catch(console.error);
            }
            fetchConversations();
        };
        socket.on('receive_message', handler);
        return () => { socket.off('receive_message', handler); };
    }, [socket, activeConversation, user, fetchConversations]);


    // Send Message
    const sendMessage = async (content: string, conversationId: string, attachmentUrl?: string, attachmentType?: string, replyToId?: string) => {
        try {
            await api.post('/chat/messages', {
                conversationId,
                content,
                messageType: attachmentUrl ? 'file' : 'text',
                attachment: attachmentUrl ? { url: attachmentUrl, type: attachmentType } : undefined,
                replyToId
            });
        } catch (error) {
            console.error('Failed to send message', error);
        }
    };

    // Join/Select Conversation
    const selectConversation = (conversation: Conversation) => {
        setActiveConversation(conversation);
        loadMessages(conversation.id);
        if (socket) {
            socket.emit('join_conversation', conversation.id);
        }
    };

    const startNewConversation = async (participantId: string) => {
        try {
            const res = await api.post('/chat/conversations', { participantId });
            const { conversationId } = res.data;
            // Fetch updated list and select it
            await fetchConversations();
            const newConv = conversations.find((c: Conversation) => c.id === conversationId) ||
                (await api.get('/chat/conversations')).data.find((c: any) => c.id === conversationId);

            if (newConv) selectConversation(newConv);
        } catch (error) {
            console.error('Failed to start conversation', error);
        }
    };

    const emitTyping = (conversationId: string, isTyping: boolean) => {
        if (socket && user) {
            socket.emit('typing', { conversationId, userId: user.id, isTyping });
        }
    };

    const uploadAttachment = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await api.post('/chat/attachments', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            return res.data; // { url, type, originalName }
        } catch (error) {
            console.error('Failed to upload attachment', error);
            return null;
        }
    };

    // Delete Message (Optimistic + API)
    const deleteMessage = async (messageId: string, forEveryone: boolean) => {
        const previousMessages = [...messages];
        // Optimistic update
        setMessages(prev => prev.filter(msg => msg.id !== messageId));

        try {
            await api.post(`/chat/messages/${messageId}/delete`, { forEveryone });
        } catch (error) {
            console.error('Failed to delete message:', error);
            // Revert on failure
            setMessages(previousMessages);
        }
    };

    const reactToMessage = async (messageId: string, reactionType: string) => {
        const previousMessages = [...messages];
        setMessages(prev => prev.map(msg => {
            if (msg.id === messageId) {
                const reactions = msg.reactions || [];
                const existing = reactions.find(r => r.userId === user?.id && r.type === reactionType);
                if (existing) {
                    return { ...msg, reactions: reactions.filter(r => r.userId !== user?.id) };
                } else {
                    const withoutMyReactions = reactions.filter(r => r.userId !== user?.id);
                    return { ...msg, reactions: [...withoutMyReactions, { type: reactionType, userId: user?.id! }] };
                }
            }
            return msg;
        }));

        try {
            await api.post(`/chat/messages/${messageId}/react`, { reactionType });
        } catch (error) {
            setMessages(previousMessages);
        }
    };

    return {
        conversations,
        activeConversation,
        messages,
        loading,
        typingUsers,
        fetchConversations,
        selectConversation,
        sendMessage,
        startNewConversation,
        emitTyping,
        uploadAttachment,
        deleteMessage,
        reactToMessage,
        user
    };
};
