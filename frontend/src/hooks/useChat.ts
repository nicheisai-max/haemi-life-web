import { useState, useEffect, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { encrypt, decrypt } from '../utils/security';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface Message {
    id: string; conversation_id: string; sender_id: string; content: string;
    message_type: 'text' | 'file'; attachments?: { url: string; type: string; size: number; name?: string }[];
    is_read: boolean; status: 'sent' | 'delivered' | 'read'; delivered_at?: string;
    read_at?: string; created_at: string; sender_name?: string; isMe?: boolean;
    reactions?: { type: string; userId: string }[];
    reply_to?: { id: string; content: string; sender_name: string }; reply_to_id?: string;
}

export interface Conversation {
    id: string; updated_at: string; last_message_at: string; last_message?: string;
    participants: { id: string; name: string; role: string; profile_image?: string }[];
    unread_count: string; message_count?: string;
}

export const useChat = () => {
    const { user, token, authStatus } = useAuth();
    const [socket, setSocket] = useState<any>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const activeConversationRef = useRef<Conversation | null>(null);

    useEffect(() => { activeConversationRef.current = activeConversation; }, [activeConversation]);

    const fetchConversations = useCallback(async () => {
        if (authStatus !== 'authenticated') return;
        try {
            const res = await api.get('/chat/conversations');
            const data = res.data;
            const decryptedConversations = await Promise.all(data.map(async (conv: any) => ({
                ...conv,
                last_message: conv.last_message ? await decrypt(conv.last_message) : conv.last_message
            })));
            setConversations(decryptedConversations);
        } catch (error) {
            console.error('Failed to fetch conversations', error);
        }
    }, [authStatus]);

    const loadMessages = useCallback(async (conversationId: string) => {
        setLoading(true);
        try {
            const res = await api.get(`/chat/messages/${conversationId}`);
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
            if (formattedMessages.some(m => !m.isMe && m.status === 'sent')) {
                api.put(`/chat/conversations/${conversationId}/delivered`).catch(console.error);
            }
            await api.put(`/chat/conversations/${conversationId}/read`);
            fetchConversations();
        } catch (error) {
            console.error('Failed to load messages', error);
        } finally {
            setLoading(false);
        }
    }, [user, fetchConversations]);

    useEffect(() => {
        if (user && token && authStatus === 'authenticated') {
            const newSocket = io(SOCKET_URL, {
                auth: { token },
                transports: ['websocket'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
            });

            newSocket.on('connect_error', (error: Error) => {
                if (error.message === 'Authentication required' || error.message === 'Invalid authentication token') {
                    // Handled by auth:token-refreshed listener
                }
            });

            // FIX 4: Socket Auth Revalidation
            const handleTokenRefreshed = (e: any) => {
                const newToken = e.detail.token;
                if (newSocket && newToken) {
                    // @ts-ignore
                    newSocket.auth.token = newToken;
                    if (!newSocket.connected) newSocket.connect();
                }
            };

            window.addEventListener('auth:token-refreshed', handleTokenRefreshed);

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

            newSocket.on('message_deleted', ({ messageId, forEveryone }: any) => {
                if (forEveryone) setMessages(prev => prev.filter(msg => msg.id !== messageId));
            });

            newSocket.on('user_typing', ({ userId, isTyping }: { userId: string, isTyping: boolean }) => {
                if (isTyping) setTypingUsers((prev: string[]) => [...new Set([...prev, userId])]);
                else setTypingUsers((prev: string[]) => prev.filter(id => id !== userId));
            });

            newSocket.on('messages_delivered', ({ conversation_id, message_ids }: any) => {
                if (activeConversationRef.current?.id === conversation_id) {
                    setMessages(prev => prev.map(msg =>
                        message_ids.includes(msg.id) ? { ...msg, status: 'delivered' } : msg
                    ));
                }
            });

            newSocket.on('messages_read', ({ conversation_id, message_ids }: any) => {
                if (activeConversationRef.current?.id === conversation_id) {
                    setMessages(prev => prev.map(msg =>
                        message_ids.includes(msg.id) ? { ...msg, status: 'read', is_read: true } : msg
                    ));
                }
                fetchConversations();
            });

            setSocket(newSocket);
            return () => {
                window.removeEventListener('auth:token-refreshed', handleTokenRefreshed);
                newSocket.disconnect();
            };
        }
    }, [user?.id, token]); // Re-run if user ID or token changes

    useEffect(() => {
        if (!socket) return;
        const handler = async (message: Message) => {
            const decryptedContent = await decrypt(message.content);
            const decryptedReplyContent = message.reply_to ? await decrypt(message.reply_to.content) : undefined;

            if (activeConversation && message.conversation_id === activeConversation.id) {
                setMessages((prev: Message[]) => {
                    if (prev.some(m => String(m.id) === String(message.id))) return prev;
                    return [...prev, {
                        ...message,
                        content: decryptedContent,
                        isMe: message.sender_id === user?.id,
                        reply_to: message.reply_to ? { ...message.reply_to, content: decryptedReplyContent! } : undefined
                    }];
                });
                api.put(`/chat/conversations/${activeConversation.id}/delivered`).catch(console.error);
            } else if (message.sender_id !== user?.id) {
                setConversations(prev => {
                    const index = prev.findIndex(c => c.id === message.conversation_id);
                    if (index === -1) return prev;
                    const newConversations = [...prev];
                    const target = newConversations[index];
                    newConversations[index] = {
                        ...target,
                        unread_count: (parseInt(target.unread_count || '0') + 1).toString(),
                        last_message: decryptedContent,
                        last_message_at: message.created_at
                    };
                    const [moved] = newConversations.splice(index, 1);
                    return [moved, ...newConversations];
                });
                api.put(`/chat/conversations/${message.conversation_id}/delivered`).catch(console.error);
            }
            fetchConversations();
        };
        socket.on('receive_message', handler);
        return () => { socket.off('receive_message', handler); };
    }, [socket, activeConversation, user, fetchConversations]);

    const sendMessage = async (content: string, conversationId: string, attachmentUrl?: string, attachmentType?: string, replyToId?: string) => {
        try {
            const encryptedContent = await encrypt(content);
            await api.post('/chat/messages', {
                conversationId, content: encryptedContent,
                messageType: attachmentUrl ? 'file' : 'text',
                attachment: attachmentUrl ? { url: attachmentUrl, type: attachmentType } : undefined,
                replyToId
            });
        } catch (error) { console.error('Failed to send message', error); }
    };

    const selectConversation = (conversation: Conversation) => {
        setActiveConversation(conversation);
        loadMessages(conversation.id);
        if (socket) socket.emit('join_conversation', conversation.id);
        api.put(`/chat/conversations/${conversation.id}/read`).then(() => fetchConversations()).catch(console.error);
    };

    const startNewConversation = async (participantId: string) => {
        try {
            const res = await api.post('/chat/conversations', { participantId });
            const { conversationId } = res.data;
            await fetchConversations();
            const newConv = conversations.find((c: Conversation) => c.id === conversationId) ||
                (await api.get('/chat/conversations')).data.find((c: any) => c.id === conversationId);
            if (newConv) selectConversation(newConv);
        } catch (error) { console.error('Failed to start conversation', error); }
    };

    const emitTyping = (conversationId: string, isTyping: boolean) => {
        if (socket && user) socket.emit('typing', { conversationId, userId: user.id, isTyping });
    };

    const uploadAttachment = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await api.post('/chat/attachments', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            return res.data;
        } catch (error) { console.error('Failed to upload', error); return null; }
    };

    const deleteMessage = async (messageId: string, forEveryone: boolean) => {
        const previousMessages = [...messages];
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
        try { await api.post(`/chat/messages/${messageId}/delete`, { forEveryone }); }
        catch (error) { setMessages(previousMessages); }
    };

    const reactToMessage = async (messageId: string, reactionType: string) => {
        const previousMessages = [...messages];
        setMessages(prev => prev.map(msg => {
            if (msg.id === messageId) {
                const reactions = msg.reactions || [];
                const existing = reactions.find(r => r.userId === user?.id && r.type === reactionType);
                if (existing) return { ...msg, reactions: reactions.filter(r => r.userId !== user?.id) };
                const withoutMyReactions = reactions.filter(r => r.userId !== user?.id);
                return { ...msg, reactions: [...withoutMyReactions, { type: reactionType, userId: user?.id! }] };
            }
            return msg;
        }));
        try { await api.post(`/chat/messages/${messageId}/react`, { reactionType }); }
        catch (error) { setMessages(previousMessages); }
    };

    const markAsRead = useCallback(async (conversationId: string) => {
        try { await api.put(`/chat/conversations/${conversationId}/read`); fetchConversations(); }
        catch (error) { console.error('Failed to mark read', error); }
    }, [fetchConversations]);

    return {
        conversations, activeConversation, messages, loading, typingUsers,
        fetchConversations, selectConversation, sendMessage, startNewConversation,
        emitTyping, uploadAttachment, deleteMessage, reactToMessage, markAsRead, user
    };
};
