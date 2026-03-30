import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChatContext } from './chat-context';
import { useAuth } from '../hooks/use-auth';
import api from '../services/api';
import { decrypt, encrypt } from '../utils/security';
import { socketService, type ServerToClientEvents } from '../services/socket.service';
import type { Conversation, Message } from '../hooks/use-chat';
import { logger } from '../utils/logger';
import axios from 'axios';

// 🔒 STRICT ATTACHMENT CONTRACT (Step 5)
interface Attachment {
    url: string;
    type: string;
    size: number;
    name: string;
}

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, token, isAuthenticated } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const [presence, setPresence] = useState<Record<string, { isOnline: boolean, lastSeen: string }>>({});
    // Defensive check to ensure state is in scope for async handlers
    if (typeof typingUsers === 'undefined') {
        logger.warn('[ChatProvider] Emergency state recovery triggered');
    }
    const activeConversationRef = useRef<Conversation | null>(null);
    const lastSyncRef = useRef<string>(new Date().toISOString());
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isTypingRef = useRef<boolean>(false);
    const lastReadRequestRef = useRef<Record<string, number>>({});
    const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    const getAbortController = useCallback((key: string) => {
        if (abortControllersRef.current.has(key)) {
            abortControllersRef.current.get(key)?.abort();
        }
        const controller = new AbortController();
        abortControllersRef.current.set(key, controller);
        return controller;
    }, []);

    useEffect(() => {
        activeConversationRef.current = activeConversation;
    }, [activeConversation]);

    const fetchPresenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const activePresenceRequestRef = useRef<Promise<void> | null>(null);
    const pendingPresenceIdsRef = useRef<Set<string>>(new Set());

    const fetchPresence = useCallback(async (userIds: string[]) => {
        if (!userIds || userIds.length === 0) return;

        // 1. Add to pending queue
        // P0 PROTOCOL: EXACT ID MATCHING (NO NORMALIZATION)
        userIds.forEach(id => pendingPresenceIdsRef.current.add(String(id)));

        // 2. Clear existing timeout to debounce
        if (fetchPresenceTimeoutRef.current) clearTimeout(fetchPresenceTimeoutRef.current);

        // 3. Set new timeout
        fetchPresenceTimeoutRef.current = setTimeout(async () => {
            // 4. Guard: If a request is already in flight, wait for it or yield
            if (activePresenceRequestRef.current) {
                // We'll let the next debounce cycle handle it to prevent overlapping
                return;
            }

            const idsToFetch = Array.from(pendingPresenceIdsRef.current);
            if (idsToFetch.length === 0) return;

            // Clear queue immediately to avoid duplicates in next cycle
            pendingPresenceIdsRef.current.clear();

            try {
                activePresenceRequestRef.current = (async () => {
                    interface PresenceRecord {
                        isOnline: boolean;
                        lastSeen: string;
                    }
                    interface PresenceApiResponse {
                        success?: boolean;
                        message?: string;
                        data?: Record<string, PresenceRecord>;
                    }

                    const res = await api.get<PresenceApiResponse | Record<string, PresenceRecord>>(`/chat/presence?userIds=${idsToFetch.join(',')}`);

                    if (res.data) {
                        const responseData: unknown = res.data;
                        let actualPayload: Record<string, PresenceRecord> = {};

                        if (responseData && typeof responseData === 'object') {
                            if ('data' in responseData && typeof (responseData as Record<string, unknown>).data === 'object') {
                                actualPayload = (responseData as Record<string, unknown>).data as Record<string, PresenceRecord>;
                            } else {
                                actualPayload = responseData as Record<string, PresenceRecord>;
                            }
                        }

                        setPresence(prev => ({ ...prev, ...actualPayload }));
                    }
                })();
                await activePresenceRequestRef.current;
            } catch (err: unknown) {
                logger.error('[ChatProvider] Failed to fetch presence:', err instanceof Error ? err.message : String(err));
                // On error, we could re-add IDs to queue, but for now we'll just fail silently
            } finally {
                activePresenceRequestRef.current = null;
            }
        }, 300); // 300ms debounce window
    }, []);

    const fetchConversations = useCallback(async () => {
        if (!isAuthenticated) return;
        const controller = getAbortController('fetchConversations');
        try {
            const res = await api.get<{ data: Conversation[] } | Conversation[]>('/chat/conversations', { signal: controller.signal });
            // P0 FIX: Hardened unwrapping for explicit JSON envelope normalization
            const payload = res.data;

            if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data: unknown }).data)) {
                throw new Error("Invalid API response: conversations")
            }

            const data = (payload as { data: Conversation[] }).data;
            if (!isMountedRef.current) return;

            // P0 PROTOCOL: Hard filter to strictly exclude ghost conversations
            const validConversations = data.filter((conv: Conversation) =>
                !!conv.lastMessage && !!conv.lastMessageId
            );

            const decryptedConversations = await Promise.all(validConversations.map(async (conv: Conversation) => ({
                ...conv,
                lastMessage: conv.lastMessage ? await decrypt(conv.lastMessage) : conv.lastMessage,
                participants: (() => {
                    if (!Array.isArray(conv.participants)) {
                        throw new Error("Invalid participants data")
                    }
                    return conv.participants
                })().map((p: { id: string; name: string; role: string; profileImage?: string }) => ({
                    ...p,
                    id: String(p.id),
                    profileImage: p.profileImage // Normalized by API mapper
                }))
            })));

            // P0: Self-Healing Guard - ensure zero ghost threads enter global state
            const uniqueConversations = Array.from(
                new Map(decryptedConversations.map((c: Conversation) => [c.id, c])).values()
            ).filter(c => !!c.lastMessage && !!c.lastMessageId);

            setConversations(uniqueConversations as Conversation[]);

            // Fetch initial presence for all unique participants
            const participantIds = [...new Set(decryptedConversations.flatMap((c: Conversation) => c.participants.map(p => p.id)))];
            if (participantIds.length > 0) {
                fetchPresence(participantIds);
            }
        } catch (err: unknown) {
            if (axios.isCancel(err)) return; // Tactical suppression of network aborts
            logger.error('[ChatProvider] Failed to fetch conversations:', err instanceof Error ? err.message : String(err));
        }
    }, [isAuthenticated, fetchPresence, getAbortController]);

    const loadMessages = useCallback(async (conversationId: string) => {
        setLoading(true);
        const controller = getAbortController(`loadMessages:${conversationId}`);
        try {
            const res = await api.get<{ data: Message[] }>(`/chat/messages/${conversationId}`, { signal: controller.signal });
            const payload = res.data;

            if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data: unknown }).data)) {
                throw new Error("Invalid messages response")
            }

            const data = (payload as { data: Message[] }).data;
            if (!isMountedRef.current) return;
            const formattedMessages = (await Promise.all(data.map(async (msg: Message): Promise<Message> => ({
                ...msg,
                content: await decrypt(msg.content),
                isMe: msg.senderId === user?.id,
                attachments: (() => {
                    if (!Array.isArray(msg.attachments)) {
                        throw new Error("Invalid attachments payload")
                    }
                    return msg.attachments
                })().reduce((acc: Attachment[], att) => {
                    if (att.url && att.type && att.name && typeof att.size === 'number') {
                        acc.push({
                            url: att.url,
                            type: att.type,
                            size: att.size,
                            name: att.name
                        });
                    }
                    return acc;
                }, []),
                replyTo: msg.replyTo ? {
                    ...msg.replyTo,
                    content: await decrypt(msg.replyTo.content)
                } : undefined
            })))).filter((msg): msg is Message => msg !== null);

            // P3: Use strict, stable sorting logic
            const sortedMessages = formattedMessages.sort((a, b) => {
                const seqA = a.sequenceNumber || 0;
                const seqB = b.sequenceNumber || 0;
                if (seqA !== seqB) return seqA - seqB;
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            });

            // P1 FIX: Prevent race condition if user switched conversation during load
            if (activeConversationRef.current?.id !== conversationId && conversationId !== 'sync') return;

            setMessages(sortedMessages);
            if (sortedMessages.some(m => !m.isMe && m.status === 'sent')) {
                api.put(`/chat/conversations/${conversationId}/delivered`).catch(() => { });
            }
            await api.put(`/chat/conversations/${conversationId}/read`);
        } catch (err: unknown) {
            if (axios.isCancel(err)) return; // Tactical suppression of network aborts
            logger.error('[ChatProvider] Failed to load messages:', err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, [user, getAbortController]);

    useEffect(() => {
        if (!isAuthenticated || !token || !user?.id) return;



        const onUserStatus: ServerToClientEvents["userStatus"] = (data) => {
            setPresence(prev => ({
                ...prev,
                [data.userId]: { isOnline: data.isOnline, lastSeen: data.lastSeen }
            }));
        };

        const syncMissedMessages = async () => {
            try {
                const res = await api.get<{ data: Message[] } | Message[]>(`/chat/sync?since=${lastSyncRef.current}`);
                // P0 FIX: Hardened unwrapping for explicit JSON envelope normalization
                const payload = res.data;

                if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data: unknown }).data)) {
                    throw new Error("Invalid sync response")
                }

                const missedMessages = (payload as { data: Message[] }).data;

                if (missedMessages.length > 0) {
                    for (const msg of missedMessages) {
                        await onReceiveMessage(msg);
                    }
                    logger.info(`[ChatProvider] Recovered ${missedMessages.length} missed messages.`);
                }
            } catch (err: unknown) {
                logger.error('[ChatProvider] Offline recovery failed', err instanceof Error ? err.message : String(err));
            }
        };

        const onTypingStarted: ServerToClientEvents["typingStarted"] = (data) => {
            setTypingUsers((prev) => [...new Set([...prev, data.name])]);
        };

        const onTypingStopped: ServerToClientEvents["typingStopped"] = (data) => {
            setTypingUsers((prev) => prev.filter(name => name !== data.name));
        };


        const onMessageRead: ServerToClientEvents["message:read"] = ({ messageId }) => {
            setMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, status: 'read', isRead: true } : msg
            ));
        };

        const onMessageDeleted: ServerToClientEvents["messageDeleted"] = ({ messageId }) => {
            // P6: Propagation of deletion across thread + sidebar
            setMessages(prev => prev.filter(m => m.id !== messageId));
            setConversations(prev => prev.map(c =>
                c.lastMessageId === messageId ? { ...c, lastMessage: 'Message deleted' } : c
            ));
        };

        const onMessageReaction: ServerToClientEvents["messageReaction"] = (data) => {
            setMessages(prev => prev.map(msg => {
                if (msg.id === data.messageId) {
                    const reactions = msg.reactions || [];
                    if (data.action === 'added') {
                        // Avoid duplicates
                        const exists = reactions.some(r => r.userId === data.userId && r.type === data.reactionType);
                        if (exists) return msg;
                        return { ...msg, reactions: [...reactions, { type: data.reactionType, userId: data.userId }] };
                    } else {
                        return { ...msg, reactions: reactions.filter(r => !(r.userId === data.userId && r.type === data.reactionType)) };
                    }
                }
                return msg;
            }));
        };

        const onReceiveMessage: ServerToClientEvents["messageReceived"] = async (message) => {
            const decryptedContent = await decrypt(message.content);
            const decryptedReplyContent = message.replyTo ? await decrypt(message.replyTo.content) : undefined;

            const formattedMessage = {
                ...message,
                content: decryptedContent,
                isMe: message.senderId === user?.id,
                attachments: (() => {
                    if (!Array.isArray(message.attachments)) {
                        logger.error("Invalid attachments payload (socket)");
                        return [];
                    }
                    return message.attachments
                })().reduce((acc: Attachment[], att) => {
                    if (att.url && att.type && att.name && typeof att.size === 'number') {
                        acc.push({
                            url: att.url,
                            type: att.type,
                            size: att.size,
                            name: att.name
                        });
                    }
                    return acc;
                }, []),
                replyTo: message.replyTo && decryptedReplyContent
                    ? { ...message.replyTo, content: decryptedReplyContent }
                    : undefined
            };

            // 1. Update Active Message List with Hardened Deduplication & Sorting
            if (activeConversationRef.current && message.conversationId === activeConversationRef.current.id) {
                setMessages((prev) => {
                    // Exact ID match check
                    const exists = prev.some(m => m.id === message.id);
                    if (exists) {
                        // Update status if it's our own optimistic message coming back
                        return prev.map(m => m.id === message.id ? { ...m, status: message.status } : m);
                    }

                    // SEARCH MATCH: Check for optimistic message that matches by sequence and sender
                    const optMatch = prev.find(m =>
                        String(m.id).startsWith('opt-') &&
                        m.sequenceNumber === message.sequenceNumber &&
                        m.senderId === message.senderId
                    );

                    let newMessages;
                    if (optMatch) {
                        // Transition optimistic to real early (Socket arrived before REST response)
                        newMessages = prev.map(m => m.id === optMatch.id ? formattedMessage : m);
                    } else {
                        newMessages = [...prev, formattedMessage];
                    }

                    return newMessages.sort((a, b) => {
                        const seqA = a.sequenceNumber || 0;
                        const seqB = b.sequenceNumber || 0;
                        if (seqA !== seqB) return seqA - seqB;
                        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    });
                });
            }

            // 2. State-Safe Conversation List Update
            setConversations(prev => {
                const index = prev.findIndex(c => c.id === message.conversationId);
                if (index === -1) {
                    // New conversation discovered - schedule fetch
                    fetchConversations();
                    return prev;
                }
                const newConversations = [...prev];
                const target = newConversations[index];

                const isUnread = message.senderId !== user?.id && activeConversationRef.current?.id !== message.conversationId;

                newConversations[index] = {
                    ...target,
                    unreadCount: isUnread ? (target.unreadCount || 0) + 1 : target.unreadCount,
                    lastMessage: decryptedContent,
                    lastMessageAt: message.createdAt
                };

                // Update last sync timestamp
                if (new Date(message.createdAt) > new Date(lastSyncRef.current)) {
                    lastSyncRef.current = message.createdAt;
                }

                const [moved] = newConversations.splice(index, 1);
                return [moved, ...newConversations];
            });

            // 3. ENTERPRISE ACKNOWLEDGEMENT FLOW (Delivery & Read)
            if (message.senderId !== user?.id) {
                if (activeConversationRef.current?.id === message.conversationId) {
                    socketService.emit('message:read', { messageId: message.id, userId: user?.id || '' });
                    api.put(`/chat/conversations/${message.conversationId}/read`).catch(() => { });
                } else {
                    socketService.emit('ackDelivery', { conversationId: message.conversationId, messageId: message.id });
                    api.put(`/chat/conversations/${message.conversationId}/delivered`).catch(() => { });
                }
            }
        };

        socketService.connect(token);
        socketService.on('typingStarted', onTypingStarted);
        socketService.on('typingStopped', onTypingStopped);
        socketService.on('message:read', onMessageRead);
        socketService.on('messageReceived', onReceiveMessage);
        socketService.on('messageDeleted', onMessageDeleted);
        socketService.on('messageReaction', onMessageReaction);
        socketService.on('userStatus', onUserStatus);
        socketService.on('reconnect', syncMissedMessages);

        // Initial fetch
        fetchConversations();

        return () => {
            socketService.off('userStatus', onUserStatus);
            socketService.off('typingStarted', onTypingStarted);
            socketService.off('typingStopped', onTypingStopped);
            socketService.off('message:read', onMessageRead);
            socketService.off('messageReceived', onReceiveMessage);
            socketService.off('messageDeleted', onMessageDeleted);
            socketService.off('messageReaction', onMessageReaction);

            // P0: Physical Disconnection on unmount/auth-loss
            // This ensures the backend disconnect event fires immediately
            socketService.disconnect();
        };
    }, [isAuthenticated, user?.id, token, fetchConversations]);

    const sendMessage = async (content: string, conversationId: string, attachmentUrl?: string, attachmentType?: string, replyToId?: string, attachmentName?: string) => {
        const optimisticId = `opt-${Date.now()}`;
        const resolvedType: 'text' | 'image' | 'document' = attachmentUrl
            ? (attachmentType?.startsWith('image/') ? 'image' : 'document')
            : 'text';

        const optimisticMessage: Message = {
            id: optimisticId,
            conversationId,
            senderId: user?.id || '',
            content,
            messageType: resolvedType,
            status: 'sending',
            sequenceNumber: (conversations.find(c => c.id === conversationId)?.sequenceCounter || 0) + 1,
            createdAt: new Date().toISOString(),
            isMe: true,
            attachments: attachmentUrl ? [{
                url: attachmentUrl,
                type: attachmentType || 'application/octet-stream',
                name: attachmentName || 'attachment',
                size: 0
            }] : []
        };

        // Optimistic UI: Update Message List
        setMessages(prev => [...prev, optimisticMessage]);

        // Optimistic UI: Update Sidebar
        setConversations(prev => {
            const index = prev.findIndex(c => c.id === conversationId);
            if (index === -1) return prev;
            const newConversations = [...prev];
            const target = newConversations[index];
            newConversations[index] = {
                ...target,
                lastMessage: content || (attachmentUrl ? '📎 Attachment' : ''),
                lastMessageAt: optimisticMessage.createdAt
            };
            const [moved] = newConversations.splice(index, 1);
            return [moved, ...newConversations];
        });

        try {
            const encryptedContent = await encrypt(content);
            const res = await api.post('/chat/messages', {
                conversationId, content: encryptedContent,
                messageType: resolvedType,
                attachment: attachmentUrl ? { url: attachmentUrl, type: attachmentType, originalName: attachmentName } : undefined,
                replyToId
            });

            // Replacement Logic: Match by ID, ensuring zero fallback to content/timestamp
            if (res.data) {
                const realMessage = {
                    ...res.data,
                    content,
                    isMe: true
                };
                setMessages(prev => {
                    // SAFETY DEDUPE: Check if the socket already added this real ID (UUID)
                    const socketAdded = prev.some(m => m.id === realMessage.id);
                    if (socketAdded) {
                        // Just purge the optimistic marker
                        return prev.filter(m => m.id !== optimisticId);
                    }
                    // Standard inline replacement
                    return prev.map(m => (m.id === optimisticId) ? realMessage : m);
                });
            }
        } catch (error: unknown) {
            logger.error('[ChatProvider] Failed to send message:', error instanceof Error ? error.message : String(error));
            // Rollback optimistic message on failure
            setMessages(prev => prev.filter(m => m.id !== optimisticId));
            // Rollback conversation state would be complex; usually user will see failure badge
        }
    };

    const selectConversation = (conversation: Conversation) => {
        // P0 RACE CONDITION FIX: Update ref IMMEDIATELY to prevent duplicate selection/load
        if (activeConversationRef.current?.id === conversation.id) return;

        activeConversationRef.current = conversation;
        setActiveConversation(conversation);
        loadMessages(conversation.id);
        socketService.emit('joinConversation', conversation.id);

        // Fetch presence for the other participant specifically
        if (!Array.isArray(conversation.participants)) {
            throw new Error("Invalid participants data")
        }

        const otherIds = conversation.participants.map(p => p.id).filter(id => id !== user?.id);
        if (otherIds.length > 0) fetchPresence(otherIds);
    };

    const startNewConversation = async (participantId: string) => {
        try {
            const res = await api.post<{ data: { conversationId: string } }>('/chat/conversations', { participantId });
            if (!res.data || typeof res.data !== 'object' || !res.data.data?.conversationId) {
                throw new Error("Invalid conversation response")
            }

            const conversationId = res.data.data.conversationId;
            await fetchConversations();
            // The list fetch will populate conversations, then we find it
            const resConv = await api.get<{ data: Conversation[] } | Conversation[]>('/chat/conversations');

            const payload = resConv.data;

            if (
                !payload ||
                typeof payload !== 'object' ||
                !Array.isArray((payload as { data: unknown }).data)
            ) {
                throw new Error("Invalid conversations response")
            }

            const convData = (payload as { data: Conversation[] }).data;
            const newConv = convData.find((c: Conversation) => c.id === conversationId);
            if (newConv) selectConversation(newConv);
        } catch (err: unknown) {
            logger.error('[ChatProvider] Failed to start conversation:', err instanceof Error ? err.message : String(err));
        }
    };

    const emitTyping = (conversationId: string, isTyping: boolean) => {
        if (!user || !isAuthenticated) return;

        // Enterprise Throttling: Start immediately, stop after inactivity
        if (isTyping) {
            if (!isTypingRef.current) {
                isTypingRef.current = true;
                socketService.emit('typingStarted', { conversationId, name: user.name || 'User' });
            }

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                isTypingRef.current = false;
                socketService.emit('typingStopped', { conversationId, name: user.name || 'User' });
            }, 3000); // 3 second inactivity timeout
        } else {
            if (isTypingRef.current) {
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                isTypingRef.current = false;
                socketService.emit('typingStopped', { conversationId, name: user.name || 'User' });
            }
        }
    };

    interface AttachmentDTO {
        url: string;
        tempId: string | number;
        type: string;
        originalName: string;
    }

    interface ApiResponse<T> {
        success: boolean;
        message: string;
        data: T;
        statusCode: number;
    }

    const uploadAttachment = async (file: File): Promise<AttachmentDTO | null> => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await api.post<ApiResponse<AttachmentDTO>>('/chat/attachments', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (!res.data || !res.data.success || !res.data.data) {
                throw new Error("Invalid attachment response")
            }

            return res.data.data;
        } catch (err: unknown) {
            logger.error('[ChatProvider] Failed to upload:', err instanceof Error ? err.message : String(err));
            return null;
        }
    };

    const deleteMessage = async (messageId: string, forEveryone: boolean) => {
        const previousMessages = [...messages];
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
        try {
            await api.post(`/chat/messages/${messageId}/delete`, { forEveryone });
            // Local sync only, no blind refetch
            setConversations(prev => prev.map(c => {
                if (c.id === activeConversationRef.current?.id && c.lastMessageId === messageId) {
                    return { ...c, lastMessage: 'Message deleted' };
                }
                return c;
            }));
        }
        catch (err: unknown) {
            logger.error('[ChatProvider] Delete failed:', err instanceof Error ? err.message : String(err));
            setMessages(previousMessages);
        }
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
        try {
            await api.post(`/chat/messages/${messageId}/react`, { reactionType });
        }
        catch (err: unknown) {
            logger.error('[ChatProvider] Reaction failed:', err instanceof Error ? err.message : String(err));
            setMessages(previousMessages);
        }
    };

    const markAsRead = async (conversationId: string) => {
        const now = Date.now();
        const lastRead = lastReadRequestRef.current[conversationId] || 0;

        // ENTERPRISE THROTTLING: Max 1 request per 2 seconds per conversation for read status
        if (now - lastRead < 2000) return;

        try {
            lastReadRequestRef.current[conversationId] = now;
            await api.put<void>(`/chat/conversations/${conversationId}/read`);

            // Standardize unread badge sync locally
            setConversations(prev => prev.map(c =>
                c.id === conversationId ? { ...c, unreadCount: 0 } : c
            ));
        } catch (err: unknown) {
            logger.error('[ChatProvider] Failed to mark read:', err instanceof Error ? err.message : String(err));
            // Reset throttle on failure to allow retry
            lastReadRequestRef.current[conversationId] = 0;
        }
    };

    const markMessageAsRead = async (messageId: string) => {
        if (!user || !isAuthenticated) return;

        try {
            socketService.emit('message:read', { messageId, userId: user.id });
            // Optional: Backend persistency call if not already handled by conversation-level markAsRead
        } catch (err: unknown) {
            logger.error('[ChatProvider] Failed to emit message:read', err instanceof Error ? err.message : String(err));
        }
    };

    return (
        <ChatContext.Provider value={{
            conversations, activeConversation, messages, loading, typingUsers, presence,
            fetchConversations, selectConversation, sendMessage, startNewConversation,
            emitTyping, uploadAttachment, deleteMessage, reactToMessage, markAsRead, markMessageAsRead, user
        }}>
            {children}
        </ChatContext.Provider>
    );
};
