import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChatContext } from './chat-context';
import { useAuth } from '../hooks/use-auth';
import api from '../services/api';
import { decrypt, encrypt } from '../utils/security';
import { socketService } from '../services/socket.service';
import type { Conversation, Message } from '../hooks/use-chat';

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, token, isAuthenticated } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    // Defensive check to ensure state is in scope for async handlers
    if (typeof typingUsers === 'undefined') {
        console.warn('[ChatProvider] Emergency state recovery triggered');
    }
    const activeConversationRef = useRef<Conversation | null>(null);
    const lastSyncRef = useRef<string>(new Date().toISOString());
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isTypingRef = useRef<boolean>(false);

    useEffect(() => {
        activeConversationRef.current = activeConversation;
    }, [activeConversation]);

    const fetchConversations = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const res = await api.get('/chat/conversations');
            const data = res.data;
            // P1 FIX: Strictly filter out any conversations with NO real messages or empty previews
            const validConversations = data.filter((conv: Conversation) => 
                conv.last_message && conv.last_message.trim() !== ''
            );

            const decryptedConversations = await Promise.all(validConversations.map(async (conv: Conversation) => ({
                ...conv,
                last_message: conv.last_message ? await decrypt(conv.last_message) : conv.last_message
            })));
            setConversations(decryptedConversations);
        } catch {
            console.error('Failed to fetch conversations');
        }
    }, [isAuthenticated]);

    const loadMessages = useCallback(async (conversationId: string) => {
        setLoading(true);
        try {
            const res = await api.get(`/chat/messages/${conversationId}`);
            const formattedMessages = await Promise.all(res.data.map(async (msg: Message) => ({
                ...msg,
                content: await decrypt(msg.content),
                isMe: msg.sender_id === user?.id,
                reply_to: msg.reply_to ? {
                    ...msg.reply_to,
                    content: await decrypt(msg.reply_to.content)
                } : undefined
            })));
            const sortedMessages = formattedMessages.sort((a, b) => {
                const seqA = parseInt(String(a.sequence_number || '0'));
                const seqB = parseInt(String(b.sequence_number || '0'));
                if (seqA !== seqB) return seqA - seqB;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            });

            // P1 FIX: Prevent race condition if user switched conversation during load
            if (activeConversationRef.current?.id !== conversationId) return;

            setMessages(sortedMessages);
            if (sortedMessages.some(m => !m.isMe && m.status === 'sent')) {
                api.put(`/chat/conversations/${conversationId}/delivered`).catch(() => {});
            }
            await api.put(`/chat/conversations/${conversationId}/read`);
            fetchConversations();
        } catch {
            console.error('Failed to load messages');
        } finally {
            setLoading(false);
        }
    }, [user, fetchConversations]);

    useEffect(() => {
        if (!isAuthenticated || !token || !user?.id) return;

        interface ReactionPayload {
            messageId: string;
            userId: string;
            reactionType: string;
            action: 'added' | 'removed';
        }

        const onReaction = ({ messageId, userId, reactionType, action }: ReactionPayload) => {
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
        };

        const onDeleted = ({ messageId, forEveryone }: { messageId: string; forEveryone: boolean }) => {
            if (forEveryone) setMessages(prev => prev.filter(msg => msg.id !== messageId));
        };

        const syncMissedMessages = async () => {
            try {
                const res = await api.get(`/chat/sync?since=${lastSyncRef.current}`);
                const missedMessages = res.data;

                if (missedMessages.length > 0) {
                    // Process missed messages in order
                    for (const msg of missedMessages) {
                        await onReceiveMessage(msg);
                    }
                    console.log(`[ChatProvider] Recovered ${missedMessages.length} missed messages.`);
                }
            } catch (err) {
                console.error('[ChatProvider] Offline recovery failed', err);
            }
        };

        const onTypingStarted = ({ userId }: { userId: string }) => {
            setTypingUsers((prev) => [...new Set([...prev, userId])]);
        };

        const onTypingStopped = ({ userId }: { userId: string }) => {
            setTypingUsers((prev) => prev.filter(id => id !== userId));
        };

        const onDelivered = ({ conversationId, messageIds }: { conversationId: string; messageIds: string[] }) => {
            if (activeConversationRef.current?.id === conversationId) {
                setMessages(prev => prev.map(msg =>
                    messageIds.includes(msg.id) ? { ...msg, status: 'delivered' } : msg
                ));
            }
        };

        const onRead = ({ conversationId, user_id }: { conversationId: string; user_id: string }) => {
            if (activeConversationRef.current?.id === conversationId) {
                setMessages(prev => prev.map(msg =>
                    msg.sender_id === user_id ? msg : { ...msg, status: 'read', is_read: true }
                ));
            }
            fetchConversations();
        };

        const onReceiveMessage = async (message: Message) => {
            const decryptedContent = await decrypt(message.content);
            const decryptedReplyContent = message.reply_to ? await decrypt(message.reply_to.content) : undefined;

            const formattedMessage = {
                ...message,
                content: decryptedContent,
                isMe: message.sender_id === user?.id,
                reply_to: message.reply_to && decryptedReplyContent
                    ? { ...message.reply_to, content: decryptedReplyContent }
                    : undefined
            };

            // 1. Update Active Message List with Hardened Deduplication & Sorting
            if (activeConversationRef.current && String(message.conversation_id) === String(activeConversationRef.current.id)) {
                setMessages((prev) => {
                    const exists = prev.some(m => String(m.id) === String(message.id));
                    if (exists) return prev;

                    const newMessages = [...prev, formattedMessage];
                    return newMessages.sort((a, b) => {
                        const seqA = parseInt(String(a.sequence_number || '0'));
                        const seqB = parseInt(String(b.sequence_number || '0'));
                        if (seqA !== seqB) return seqA - seqB;
                        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                    });
                });
            }

            // 2. State-Safe Conversation List Update
            setConversations(prev => {
                const index = prev.findIndex(c => c.id === message.conversation_id);
                if (index === -1) {
                    // New conversation discovered - schedule fetch
                    fetchConversations();
                    return prev;
                }
                const newConversations = [...prev];
                const target = newConversations[index];

                const isUnread = message.sender_id !== user?.id && activeConversationRef.current?.id !== message.conversation_id;

                newConversations[index] = {
                    ...target,
                    unread_count: isUnread ? (parseInt(target.unread_count || '0') + 1).toString() : target.unread_count,
                    last_message: decryptedContent,
                    last_message_at: message.created_at
                };

                // Update last sync timestamp
                if (new Date(message.created_at) > new Date(lastSyncRef.current)) {
                    lastSyncRef.current = message.created_at;
                }

                const [moved] = newConversations.splice(index, 1);
                return [moved, ...newConversations];
            });

            // 3. ENTERPRISE ACKNOWLEDGEMENT FLOW (Delivery)
            if (message.sender_id !== user?.id) {
                socketService.emit('ack_delivery', { conversationId: message.conversation_id, messageId: message.id });
                api.put(`/chat/conversations/${message.conversation_id}/delivered`).catch(() => { });
            }
        };

        socketService.connect(token);
        socketService.on('message_reaction', onReaction);
        socketService.on('message_deleted', onDeleted);
        socketService.on('typing_started', onTypingStarted);
        socketService.on('typing_stopped', onTypingStopped);
        socketService.on('message_delivered', onDelivered);
        socketService.on('message_read', onRead);
        socketService.on('message_received', onReceiveMessage);
        socketService.on('reconnect', syncMissedMessages);

        // Initial fetch
        fetchConversations();

        return () => {
            socketService.off('message_reaction', onReaction);
            socketService.off('message_deleted', onDeleted);
            socketService.off('typing_started', onTypingStarted);
            socketService.off('typing_stopped', onTypingStopped);
            socketService.off('message_delivered', onDelivered);
            socketService.off('message_read', onRead);
            socketService.off('message_received', onReceiveMessage);
        };
    }, [isAuthenticated, user?.id, token, fetchConversations]);

    const sendMessage = async (content: string, conversationId: string, attachmentUrl?: string, attachmentType?: string, replyToId?: string) => {
        try {
            const encryptedContent = await encrypt(content);
            await api.post('/chat/messages', {
                conversationId, content: encryptedContent,
                messageType: attachmentUrl ? 'file' : 'text',
                attachment: attachmentUrl ? { url: attachmentUrl, type: attachmentType } : undefined,
                replyToId
            });
        } catch { console.error('Failed to send message'); }
    };

    const selectConversation = (conversation: Conversation) => {
        if (activeConversationRef.current?.id === conversation.id) return; // Prevent duplicate selection
        setActiveConversation(conversation);
        loadMessages(conversation.id);
        socketService.emit('join_conversation', conversation.id);
        // P1 FIX: Removed redundant api.put call as loadMessages already handles marking as read
    };

    const startNewConversation = async (participantId: string) => {
        try {
            const res = await api.post('/chat/conversations', { participantId });
            const { conversationId } = res.data;
            await fetchConversations();
            // The list fetch will populate conversations, then we find it
            const resConv = await api.get('/chat/conversations');
            const newConv = resConv.data.find((c: Conversation) => c.id === conversationId);
            if (newConv) selectConversation(newConv);
        } catch { console.error('Failed to start conversation'); }
    };

    const emitTyping = (conversationId: string, isTyping: boolean) => {
        if (!user || !isAuthenticated) return;

        // Enterprise Throttling: Start immediately, stop after inactivity
        if (isTyping) {
            if (!isTypingRef.current) {
                isTypingRef.current = true;
                socketService.emit('typing_started', { conversationId, name: user.name || 'User' });
            }

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                isTypingRef.current = false;
                socketService.emit('typing_stopped', { conversationId, name: user.name || 'User' });
            }, 2000); // 2 second inactivity timeout
        } else {
            if (isTypingRef.current) {
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                isTypingRef.current = false;
                socketService.emit('typing_stopped', { conversationId, name: user.name || 'User' });
            }
        }
    };

    const uploadAttachment = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await api.post('/chat/attachments', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            return res.data;
        } catch { console.error('Failed to upload'); return null; }
    };

    const deleteMessage = async (messageId: string, forEveryone: boolean) => {
        const previousMessages = [...messages];
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
        try { await api.post(`/chat/messages/${messageId}/delete`, { forEveryone }); }
        catch { setMessages(previousMessages); }
    };

    const reactToMessage = async (messageId: string, reactionType: string) => {
        const previousMessages = [...messages];
        setMessages(prev => prev.map(msg => {
            if (msg.id === messageId) {
                const reactions = msg.reactions || [];
                const existing = reactions.find(r => r.userId === user?.id && r.type === reactionType);
                if (existing) return { ...msg, reactions: reactions.filter(r => r.userId !== user?.id) };
                const withoutMyReactions = reactions.filter(r => r.userId !== user?.id);
                return { ...msg, reactions: [...withoutMyReactions, { type: reactionType, userId: user?.id ?? '' }] };
            }
            return msg;
        }));
        try { await api.post(`/chat/messages/${messageId}/react`, { reactionType }); }
        catch { setMessages(previousMessages); }
    };

    const markAsRead = async (conversationId: string) => {
        try {
            if (user) socketService.emit('ack_read', { conversationId, user_id: user.id });
            await api.put(`/chat/conversations/${conversationId}/read`);
            fetchConversations();
        } catch { console.error('Failed to mark read'); }
    };

    return (
        <ChatContext.Provider value={{
            conversations, activeConversation, messages, loading, typingUsers,
            fetchConversations, selectConversation, sendMessage, startNewConversation,
            emitTyping, uploadAttachment, deleteMessage, reactToMessage, markAsRead, user
        }}>
            {children}
        </ChatContext.Provider>
    );
};
