import { useState, useEffect, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const SOCKET_URL = 'http://localhost:5000'; // Adjust for production

export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    attachment_url?: string;
    attachment_type?: 'image' | 'pdf' | 'document';
    is_read: boolean;
    created_at: string;
    sender_name?: string;
    isMe?: boolean; // Calculated on frontend
}

export interface Conversation {
    id: string;
    updated_at: string;
    last_message_at: string;
    last_message?: string;
    participants: { id: string; name: string; role: string }[];
    unread_count: string; // comes as string from count(*)
}

export const useChat = () => {
    const { user, token } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
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
            const newSocket = io(SOCKET_URL, {
                auth: { token },
            });

            newSocket.on('connect', () => {
                console.log('Chat socket connected');
            });

            newSocket.on('receive_message', (message: Message) => {
                // We use functional update to access latest state if needed,
                // BUT `activeConversation` might be stale in closure if we don't depend on it.
                // A better approach is to check message.conversation_id against a Ref or just
                // append if it matches.

                setMessages((prev) => {
                    if (prev.find(m => m.id === message.id)) return prev;

                    // Logic: If we are in the conversation, show it.
                    // But we don't know *inside* this callback which conversation is active unless we depend on it.
                    // If we add `activeConversation` to dependency, we re-connect socket on switch.
                    // That is acceptable for now or we use a ref.
                    return prev;
                });

                // If we trigger a fetch, we get fresh data anyway.
                fetchConversations();
            });

            newSocket.on('user_typing', ({ userId, isTyping }: { userId: string, isTyping: boolean }) => {
                if (isTyping) {
                    setTypingUsers(prev => [...new Set([...prev, userId])]);
                } else {
                    setTypingUsers(prev => prev.filter(id => id !== userId));
                }
            });

            setSocket(newSocket);

            return () => {
                newSocket.disconnect();
            };
        }
    }, [user, token, fetchConversations]); // Removing activeConversation to avoid reconnects.

    // Allow updating messages when activeConversation changes or we receive events
    useEffect(() => {
        if (!socket) return;

        const handler = (message: Message) => {
            if (activeConversation && message.conversation_id === activeConversation.id) {
                setMessages(prev => {
                    if (prev.find(m => m.id === message.id)) return prev;
                    return [...prev, { ...message, isMe: message.sender_id === user?.id }];
                });

                // Mark read if window focused? For now, automatic read on receive if active.
                api.put(`/chat/conversations/${activeConversation.id}/read`).catch(console.error);
            }
        };

        socket.on('receive_message', handler);
        return () => {
            socket.off('receive_message', handler);
        };
    }, [socket, activeConversation, user]);


    // Send Message
    const sendMessage = async (content: string, conversationId: string, attachmentUrl?: string, attachmentType?: string) => {
        try {
            await api.post('/chat/messages', {
                conversationId,
                content,
                attachmentUrl,
                attachmentType
            });
            // Socket will receive the message back and update UI via the handler
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
            const newConv = conversations.find(c => c.id === conversationId) ||
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
        user
    };
};
