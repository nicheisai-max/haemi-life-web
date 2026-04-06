import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChatContext } from './chat-context';
import { useAuth } from '../hooks/use-auth';
import api from '../services/api';
import { decrypt } from '../utils/security';
import { socketService, type ServerToClientEvents } from '../services/socket.service';
import { 
    Conversation, 
    Message, 
    Attachment, 
    AttachmentDTO,
    PresenceRecord,
    PresenceApiResponse,
    RawParticipant,
    normalizeParticipant,
    ChatApiResponse,
    ParticipantMetadata
} from '../types/chat';
import { logger } from '../utils/logger';
import { storageService } from '../services/storage.service';
import axios from 'axios';


export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, token, isAuthenticated } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const [presence, setPresence] = useState<Record<string, PresenceRecord>>({});
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

        // 3. Set new timeout — 300ms debounce window
        fetchPresenceTimeoutRef.current = setTimeout(async () => {
            // 4. Guard: If a request is already in flight, yield
            if (activePresenceRequestRef.current) return;

            const idsToFetch = Array.from(pendingPresenceIdsRef.current);
            if (idsToFetch.length === 0) return;

            // Clear queue immediately to avoid duplicates in next cycle
            pendingPresenceIdsRef.current.clear();

            try {
                const doFetch = async (): Promise<void> => {
                    // Uses centralized PresenceRecord & PresenceApiResponse from types/chat.ts
                    const res = await api.get<PresenceApiResponse | Record<string, PresenceRecord>>(
                        `/chat/presence?userIds=${idsToFetch.join(',')}`
                    );

                    if (res.data) {
                        const responseData = res.data;
                        let actualPayload: Record<string, PresenceRecord> = {};

                        if (responseData && typeof responseData === 'object') {
                            const isEnvelope = 'data' in responseData &&
                                responseData.data &&
                                typeof responseData.data === 'object' &&
                                !Array.isArray(responseData.data);

                            if (isEnvelope) {
                                actualPayload = (responseData as { data: Record<string, PresenceRecord> }).data;
                            } else {
                                actualPayload = responseData as Record<string, PresenceRecord>;
                            }
                        }

                        setPresence(prev => ({ ...prev, ...actualPayload }));
                        // Persist to IndexedDB in background
                        storageService.putPresence(actualPayload).catch((e: unknown) => {
                            logger.error('[ChatProvider] Presence persistence failed', e instanceof Error ? e.message : String(e));
                        });
                    }
                };

                activePresenceRequestRef.current = doFetch();
                await activePresenceRequestRef.current;
            } catch (err: unknown) {
                logger.error('[ChatProvider] Failed to fetch presence:', err instanceof Error ? err.message : String(err));
            } finally {
                activePresenceRequestRef.current = null;
            }
        }, 300);
    }, []);
    // ─── 2. HYDRATION: Local-First Strategy ─────────────────────────
    useEffect(() => {
        if (!isAuthenticated || !user?.id) return;

        const hydrate = async (): Promise<void> => {
            try {
                const localConversations = await storageService.getAllConversations();
                if (localConversations.length > 0 && isMountedRef.current) {
                    setConversations(localConversations);
                    logger.info(`[ChatProvider] Hydrated ${localConversations.length} conversations from IndexedDB`);
                    
                    // Fetch presence for hydrated participants
                    const partIds = [...new Set(localConversations.flatMap(c => c.participants.map(p => p.id)))];
                    if (partIds.length > 0) fetchPresence(partIds);
                }
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                logger.error('[ChatProvider] Hydration failed:', errorMessage);
            }
        };

        hydrate();
    }, [isAuthenticated, user?.id, fetchPresence]);

    const fetchConversations = useCallback(async () => {
        if (!isAuthenticated) return;
        const controller = getAbortController('fetchConversations');
        try {
            const res = await api.get<{ data: Conversation[] } | Conversation[]>('/chat/conversations', { signal: controller.signal });
            const payload = res.data;

            if (!payload || typeof payload !== 'object') {
                throw new Error("Invalid API response: conversations");
            }

            let data: Conversation[] = [];
            if (Array.isArray(payload)) {
                data = payload;
            } else if ('data' in payload && Array.isArray((payload as { data: unknown }).data)) {
                data = (payload as { data: Conversation[] }).data;
            } else {
                throw new Error("Invalid API response format: conversations");
            }

            if (!isMountedRef.current) return;

            // P0 PROTOCOL: Inclusive restoration of all institutional threads (including empty/new)
            const decryptedConversations: Conversation[] = await Promise.all(
                data.map(async (conv: Conversation): Promise<Conversation> => ({
                    ...conv,
                    lastMessage: conv.lastMessage ? await decrypt(conv.lastMessage) : conv.lastMessage,
                    participants: (conv.participants || []).map((p: RawParticipant) => normalizeParticipant(p))
                }))
            );

            // P0: Self-Healing Guard - ensure zero duplicate threads enter global state
            const uniqueConversations: Conversation[] = Array.from(
                new Map<string, Conversation>(decryptedConversations.map((c: Conversation) => [c.id, c])).values()
            );

            setConversations(uniqueConversations);

            // ─── PERSISTENCE ─────────────────────────────────────────
            // Update local IndexedDB with latest server state
            storageService.putConversations(uniqueConversations).catch((err: unknown) => {
                logger.error('[ChatProvider] Conversation persistence failed:', err instanceof Error ? err.message : String(err));
            });

            // Fetch initial presence for all unique participants
            const participantIds = [...new Set(uniqueConversations.flatMap((c: Conversation) => c.participants.map(p => p.id)))];
            if (participantIds.length > 0) {
                fetchPresence(participantIds);
            }
        } catch (err: unknown) {
            if (axios.isCancel(err)) return; // Tactical suppression of network aborts
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.error('[ChatProvider] Failed to fetch conversations:', errorMessage);
        }
    }, [isAuthenticated, fetchPresence, getAbortController]);

    const loadMessages = useCallback(async (conversationId: string) => {
        setLoading(true);
        const controller = getAbortController(`loadMessages:${conversationId}`);
        
        try {
            // 1. Local-First: Load from IndexedDB immediately
            const localMessages = await storageService.getMessagesByConversation(conversationId);
            if (localMessages.length > 0 && isMountedRef.current) {
                setMessages(localMessages);
                // Background task: delivered/read status updates can happen later
            }

            // 2. Fetch from API for latest state (Sync)
            const res = await api.get<{ data: Message[] }>(`/chat/messages/${conversationId}`, { signal: controller.signal });
            const payload = res.data;

            if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data: unknown }).data)) {
                throw new Error("Invalid messages response");
            }

            const data = (payload as { data: Message[] }).data;
            if (!isMountedRef.current) return;

            const formattedMessages = (await Promise.all(
                data.map(async (msg: Message): Promise<Message> => ({
                    ...msg,
                    content: await decrypt(msg.content),
                    isMe: msg.senderId === user?.id,
                    attachments: (msg.attachments || []).map((att: Attachment & { originalName?: string }) => ({
                        url: att.url || '',
                        type: att.type || '',
                        name: att.name || att.originalName || 'attachment',
                        size: typeof att.size === 'number' ? att.size : 0
                    })),
                    replyTo: msg.replyTo ? {
                        ...msg.replyTo,
                        content: await decrypt(msg.replyTo.content)
                    } : undefined
                }))
            ));

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

            // ─── PERSISTENCE ─────────────────────────────────────────
            // Update local IndexedDB with latest server state
            if (user?.id) {
                storageService.putMessages(sortedMessages, user.id).catch((err: unknown) => {
                    logger.error('[ChatProvider] Message persistence failed:', err instanceof Error ? err.message : String(err));
                });
            }

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
                [data.userId]: { isOnline: data.isOnline, lastActivity: data.lastActivity }
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


        const onMessageRead: ServerToClientEvents["messageRead"] = ({ messageId }) => {
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
                    socketService.emit('messageRead', { messageId: message.id, userId: user?.id || '' });
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
        socketService.on('messageRead', onMessageRead);
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
            socketService.off('messageRead', onMessageRead);
            socketService.off('messageReceived', onReceiveMessage);
            socketService.off('messageDeleted', onMessageDeleted);
            socketService.off('messageReaction', onMessageReaction);

            // P0: Physical Disconnection on unmount/auth-loss
            // This ensures the backend disconnect event fires immediately
            socketService.disconnect();
        };
    }, [isAuthenticated, user?.id, token, fetchConversations]);

    // ─── Phase 3: Background Outbox Sync ──────────────────────────────────────
    useEffect(() => {
        if (!isAuthenticated || !user?.id) return;

        const syncOutbox = async () => {
            const pending = await storageService.getPendingMessages();
            if (pending.length === 0) return;

            logger.info(`[ChatProvider] 🔄 Found ${pending.length} pending messages in Outbox. Attempting sync...`);

            for (const msg of pending) {
                try {
                    // Stripped down send logic for outbox retry
                    await api.post('/chat/messages', {
                        conversationId: msg.conversationId,
                        content: msg.content,
                        messageType: msg.messageType,
                        attachment: msg.attachments && msg.attachments.length > 0 ? {
                            url: msg.attachments[0].url,
                            type: msg.attachments[0].type,
                            originalName: msg.attachments[0].name
                        } : undefined,
                        replyToId: msg.replyToId
                    });

                    // Success: Remove from Outbox
                    await storageService.removePendingMessage(msg.id);
                    logger.info(`[ChatProvider] ✓ Outbox message ${msg.id} synced successfully`);
                } catch (err: unknown) {
                    logger.warn(`[ChatProvider] ❌ Outbox sync failed for ${msg.id}. Will retry later.`, err);
                }
            }
        };

        // Sync on mount and when coming back online
        syncOutbox();
        window.addEventListener('online', syncOutbox);
        return () => window.removeEventListener('online', syncOutbox);
    }, [isAuthenticated, user?.id]);

    const sendMessage = async (
        content: string,
        conversationId: string,
        attachmentUrl?: string,
        attachmentType?: string,
        replyToId?: string,
        attachmentName?: string
    ) => {
        if (!user?.id) return;

        // Phase 3: Optimistic UUID generation for Local-First tracking
        const tempId = `opt-${crypto.randomUUID()}`;
        const resolvedType: 'text' | 'image' | 'document' = attachmentUrl
            ? (attachmentType?.startsWith('image/') ? 'image' : 'document')
            : 'text';

        const optimisticMessage: Message = {
            id: tempId,
            tempId, // Mirroring for structural clarity
            conversationId,
            senderId: user.id,
            senderName: user.name || 'Me',
            content,
            messageType: resolvedType,
            status: 'sending',
            isRead: false,
            isMe: true,
            createdAt: new Date().toISOString(),
            sequenceNumber: (conversations.find(c => c.id === conversationId)?.sequenceCounter || 0) + 1,
            attachments: attachmentUrl ? [{
                url: attachmentUrl,
                type: attachmentType || 'application/octet-stream',
                name: attachmentName || 'attachment',
                size: 0
            }] : [],
            reactions: [],
            replyToId
        };

        // 1. PERSIST TO OUTBOX: Immediate protection against browser crash/refresh
        await storageService.putPendingMessage(optimisticMessage, user.id);

        // 2. OPTIMISTIC UI: Render instantly
        setMessages(prev => [...prev, optimisticMessage]);

        // 3. SIDEBAR UPDATE: Instant feedback
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
            // Move to top
            const [moved] = newConversations.splice(index, 1);
            return [moved, ...newConversations];
        });

        try {
            // Local decryption/encryption logic for sensitive clinical data
            const res = await api.post('/chat/messages', {
                conversationId,
                content,
                messageType: resolvedType,
                attachment: attachmentUrl ? {
                    url: attachmentUrl,
                    type: attachmentType,
                    originalName: attachmentName
                } : undefined,
                replyToId
            });

            if (res.data) {
                const realMessage = {
                    ...res.data,
                    isMe: true
                };

                // 4. STORAGE RETIREMENT: Remove from Outbox, commit to Permanent Store
                await storageService.removePendingMessage(tempId);
                await storageService.putMessages([realMessage], user.id);

                setMessages(prev => {
                    const socketAdded = prev.some(m => m.id === realMessage.id);
                    if (socketAdded) {
                        return prev.filter(m => m.id !== tempId);
                    }
                    // Institutional Guard: Replace opt-id with real-id if not already handled by socket
                    return prev.map(m => m.id === tempId ? realMessage : m);
                });
            }
        } catch (error: unknown) {
            logger.error('[ChatProvider] Transmission failure:', error);

            // 5. FAILURE HANDLING: Update Outbox status for future retry
            await storageService.updatePendingMessageStatus(tempId, 'failed');

            // Visual feedback: Update optimistic message status in state
            setMessages(prev => prev.map(m =>
                m.id === tempId ? { ...m, status: 'failed' } : m
            ));
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

    const startNewConversation = async (participantId: string, _meta?: ParticipantMetadata) => {
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



    const uploadAttachment = async (file: File): Promise<AttachmentDTO | null> => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await api.post<ChatApiResponse<AttachmentDTO>>('/chat/attachments', formData, {
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
            socketService.emit('messageRead', { messageId, userId: user.id });
            // Optional: Backend persistency call if not already handled by conversation-level markAsRead
        } catch (err: unknown) {
            logger.error('[ChatProvider] Failed to emit messageRead', err instanceof Error ? err.message : String(err));
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
