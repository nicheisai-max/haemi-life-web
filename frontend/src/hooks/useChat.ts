import { useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { encrypt, decrypt } from '../utils/security';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'; // Adjust for production

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
    const activeConversationRef = useRef<Conversation | null>(null);

    // Keep ref in sync for socket listeners to access latest state without re-creating listeners
    useEffect(() => {
        activeConversationRef.current = activeConversation;
    }, [activeConversation]);

    // Load Conversations
    const fetchConversations = useCallback(async () => {
        try {
            const res = await api.get('/chat/conversations');
            const data = res.data;

            // Decrypt last messages if they are encrypted
            const decryptedConversations = await Promise.all(data.map(async (conv: any) => ({
                ...conv,
                last_message: conv.last_message ? await decrypt(conv.last_message) : conv.last_message
            })));

            setConversations(decryptedConversations);
        } catch (error) {
            console.error('Failed to fetch conversations', error);
        }
    }, []);

    // Load Messages
    const loadMessages = useCallback(async (conversationId: string) => {
        setLoading(true);
        try {
            const res = await api.get(`/chat/messages/${conversationId}`);

            // Decrypt all messages in parallel for performance
            const formattedMessages = await Promise.all(res.data.map(async (msg: any) => ({
                ...msg,
                content: await decrypt(msg.content),
                isMe: msg.sender_id === user?.id,
                reply_to: msg.reply_to ? {
                    ...msg.reply_to,
                    content: await decrypt(msg.reply_to.content)
                } : undefined
            })));

            setMessages(formattedMessages);

            // Mark as delivered if we are loading messages that were only 'sent'
            if (formattedMessages.some(m => !m.isMe && m.status === 'sent')) {
                api.put(`/chat/conversations/${conversationId}/delivered`).catch(console.error);
            }

            // Mark as read (this will be more granular with IntersectionObserver later, 
            // but for now we mark all when entering conversation as a fallback)
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

            // Real-time Delivery Receipt
            newSocket.on('messages_delivered', ({ conversation_id, message_ids }: any) => {
                if (activeConversationRef.current?.id === conversation_id) {
                    setMessages(prev => prev.map(msg =>
                        message_ids.includes(msg.id) ? { ...msg, status: 'delivered' } : msg
                    ));
                }
            });

            // Real-time Read Receipt
            newSocket.on('messages_read', ({ conversation_id, message_ids }: any) => {
                if (activeConversationRef.current?.id === conversation_id) {
                    setMessages(prev => prev.map(msg =>
                        message_ids.includes(msg.id) ? { ...msg, status: 'read' } : msg
                    ));
                }
            });

            setSocket(newSocket);
            return () => { newSocket.disconnect(); };
        }
    }, [user, token]);

    // Message Receive Handler
    useEffect(() => {
        if (!socket) return;
        const handler = async (message: Message) => {
            console.log('Incoming message via socket:', message.id);

            // Decrypt immediately on arrival
            const decryptedContent = await decrypt(message.content);
            const decryptedReplyContent = message.reply_to ? await decrypt(message.reply_to.content) : undefined;

            if (activeConversation && message.conversation_id === activeConversation.id) {
                setMessages((prev: Message[]) => {
                    const isDuplicate = prev.some(m => String(m.id) === String(message.id));
                    if (isDuplicate) {
                        return prev;
                    }
                    return [...prev, {
                        ...message,
                        content: decryptedContent,
                        isMe: message.sender_id === user?.id,
                        reply_to: message.reply_to ? {
                            ...message.reply_to,
                            content: decryptedReplyContent!
                        } : undefined
                    }];
                });
                api.put(`/chat/conversations/${activeConversation.id}/delivered`).catch(console.error);
            } else {
                // If we are NOT in the conversation, the message is still delivered to the client
                // but we don't mark as read. We might want to mark as delivered though?
                // WhatsApp marks as delivered when the app receives it.
                api.put(`/chat/conversations/${message.conversation_id}/delivered`).catch(console.error);
            }
            fetchConversations();
        };
        socket.on('receive_message', handler);
        return () => { socket.off('receive_message', handler); };
    }, [socket, activeConversation, user, fetchConversations]);


    // Send Message
    const sendMessage = async (content: string, conversationId: string, attachmentUrl?: string, attachmentType?: string, replyToId?: string) => {
        try {
            // E2EE: Encrypt content before sending
            const encryptedContent = await encrypt(content);

            await api.post('/chat/messages', {
                conversationId,
                content: encryptedContent,
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

    const markAsRead = useCallback(async (conversationId: string) => {
        try {
            await api.put(`/chat/conversations/${conversationId}/read`);
            fetchConversations();
        } catch (error) {
            console.error('Failed to mark as read', error);
        }
    }, [fetchConversations]);

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
        markAsRead,
        user
    };
};
