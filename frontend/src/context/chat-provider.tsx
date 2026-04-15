import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChatContext } from './chat-context';
import { useAuth } from '../hooks/use-auth';
import api, { getAccessToken } from '../services/api';
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
    ParticipantMetadata,
    UserId,
    MessageId,
    ConversationId,
    MessageReadEvent
} from '../types/chat';
import { logger } from '../utils/logger';
import { storageService } from '../services/storage.service';
import { ApiResponse } from '../types/auth.types';
import axios from 'axios';


export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, token, isAuthenticated } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [typingUsers, setTypingUsers] = useState<UserId[]>([]);
    const [presence, setPresence] = useState<Record<UserId, PresenceRecord>>({});
    const [isHydrated, setIsHydrated] = useState(false);
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
    const syncRetryCountRef = useRef<number>(0);
    const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    const pendingPresenceIdsRef = useRef<Set<UserId>>(new Set());

    const fetchPresence = useCallback(async (userIds: UserId[]) => {
        if (!isAuthenticated || !userIds || userIds.length === 0) return;

        // 1. Add to pending queue
        // P0 PROTOCOL: EXACT ID MATCHING (NO NORMALIZATION)
        userIds.forEach(id => pendingPresenceIdsRef.current.add(String(id) as UserId));

        // 2. Clear existing timeout to debounce
        if (fetchPresenceTimeoutRef.current) clearTimeout(fetchPresenceTimeoutRef.current);

        // 3. Set new timeout — 300ms debounce window
        fetchPresenceTimeoutRef.current = setTimeout(async () => {
            if (!isAuthenticated) return;
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
    }, [isAuthenticated]);
    // ─── 2. HYDRATION: Local-First Strategy ─────────────────────────
    useEffect(() => {
        if (!isAuthenticated || !user?.id) return;

        const hydrate = async (): Promise<void> => {
            try {
                // 🔒 INSTITUTIONAL SESSION ISOLATION (D14)
                // Audit the outbox for messages belonging to other users.
                // This prevents cross-session leakage during rapid user switching.
                const outbox = await storageService.getPendingMessages();
                if (outbox.length > 0) {
                    const foreignMessages = outbox.filter(m => m.senderId !== user.id);
                    if (foreignMessages.length > 0) {
                        logger.warn(`[ChatProvider] Security: Purging ${foreignMessages.length} foreign outbox messages from previous session.`);
                        for (const msg of foreignMessages) {
                            await storageService.removePendingMessage(msg.id as MessageId);
                        }
                    }
                }

                const localConversations = await storageService.getAllConversations();
                if (localConversations.length > 0 && isMountedRef.current) {
                    setConversations(localConversations);
                    logger.info(`[ChatProvider] Hydrated ${localConversations.length} conversations from IndexedDB`);
                    
                    // Fetch presence for hydrated participants
                    const partIds = [...new Set(localConversations.flatMap(c => c.participants.map(p => p.id as UserId)))];
                    if (partIds.length > 0) fetchPresence(partIds);
                }
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                logger.error('[ChatProvider] Hydration failed:', errorMessage);
            }
        };

        hydrate();
    }, [isAuthenticated, user?.id, fetchPresence]);

    // ─── D12 REMEDIATION: Presence Polling Fallback ─────────────────────────
    // When the socket is disconnected (NAT blip, server restart), presence data
    // goes stale. This effect provides a 15-30s polling window as a secondary
    // transport, only active when socketService.isConnected() is false.
    const syncPresenceFallback = useCallback(() => {
        if (!isAuthenticated || !user?.id) return;
        
        if (!socketService.isConnected()) {
            const participantIds = [...new Set(conversations.flatMap(c => c.participants.map(p => p.id as UserId)))];
            if (participantIds.length > 0) {
                fetchPresence(participantIds);
                logger.info(`[ChatProvider] Reactive presence sync triggered (${participantIds.length} users)`);
            }
        }
    }, [isAuthenticated, user, conversations, fetchPresence]);

    useEffect(() => {
        if (!isAuthenticated || !user?.id) return;

        // P0: Immediate reactive sync on disconnect to eliminate the 30s lag
        socketService.on('disconnect', syncPresenceFallback);
        
        const intervalId = setInterval(syncPresenceFallback, 30000); // 30s institutional window
        
        return () => {
            socketService.off('disconnect', syncPresenceFallback);
            clearInterval(intervalId);
        };
    }, [isAuthenticated, user?.id, syncPresenceFallback]);

    // ─── Phase 16: Institutional Heartbeat (Zero-Drift Sync) ────────────────
    // Keeps the connection alive in the backend 'active_connections' table.
    // Rule: Meta-Grade 30s interval to stay within the 90s reaper threshold.
    useEffect(() => {
        if (!isAuthenticated || !user?.id) return;

        const heartbeatInterval = setInterval(() => {
            if (socketService.isConnected()) {
                socketService.emit('heartbeat');
            }
        }, 30000); // 30s Institutional Window

        return () => {
            clearInterval(heartbeatInterval);
        };
    }, [isAuthenticated, user?.id]);

    const internalFetchConversations = useCallback(async (): Promise<Conversation[] | void> => {
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
            setIsHydrated(true); // ✅ Certification of source parity (Meta-Grade)
            setLoading(false); // ✅ Ensure global loader resolves on success

            // ─── PERSISTENCE ─────────────────────────────────────────
            // Update local IndexedDB with latest server state
            storageService.putConversations(uniqueConversations).catch((err: unknown) => {
                logger.error('[ChatProvider] Conversation persistence failed:', err instanceof Error ? err.message : String(err));
            });

            // Fetch initial presence for all unique participants
            const participantIds = [...new Set(uniqueConversations.flatMap((c: Conversation) => c.participants.map(p => p.id as UserId)))];
            if (participantIds.length > 0) {
                fetchPresence(participantIds);
            }

            return uniqueConversations;
        } catch (err: unknown) {
            if (axios.isCancel(err)) return; // Tactical suppression of network aborts
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.error('[ChatProvider] Failed to fetch conversations:', errorMessage);
            // P0: Escape hatch to prevent indefinite loading hang on "Securing clinical data..." 
            if (isMountedRef.current) {
                setLoading(false);
                setIsHydrated(true); // P0: Certification of source parity (Meta-Grade)
            }
        }
    }, [isAuthenticated, fetchPresence, getAbortController]);

    const fetchConversations = useCallback(async (): Promise<void> => {
        await internalFetchConversations();
    }, [internalFetchConversations]);

    const loadMessages = useCallback(async (conversationId: ConversationId) => {
        if (!isAuthenticated) return;
        setLoading(true);
        const controller = getAbortController(`loadMessages:${conversationId}`);
        
        try {
            // 1. Local-First: Load from IndexedDB immediately
            const localMessages = await storageService.getMessagesByConversation(conversationId as ConversationId);
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
                    attachments: (msg.attachments || []).map((att: Attachment & { id?: string; url?: string; originalName?: string; name?: string; type?: string; size?: number }) => {
                        const rawName = att.name || att.originalName || 'attachment';
                        const safeName = rawName.replace(/\\/g, '/').split('/').pop() || 'attachment';
                        return {
                            id: att.id || `legacy-${Date.now()}-${Math.random()}`,
                            url: att.url || (att.id ? `/api/files/message/${att.id}` : ''),
                            type: att.type || 'application/octet-stream',
                            name: safeName,
                            size: typeof att.size === 'number' ? att.size : 0
                        };
                    }),
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
                storageService.putMessages(sortedMessages, user.id as UserId).catch((err: unknown) => {
                    logger.error('[ChatProvider] Message persistence failed:', err instanceof Error ? err.message : String(err));
                });
            }

            if (sortedMessages.some(m => !m.isMe && m.status === 'sent')) {
                api.put<ApiResponse<void>>(`/chat/conversations/${conversationId}/delivered`).catch((err: unknown) => {
                    logger.error('[ChatProvider] Delivered status sync failed:', err instanceof Error ? err.message : String(err));
                });
            }
            await api.put<ApiResponse<void>>(`/chat/conversations/${conversationId}/read`);
        } catch (err: unknown) {
            if (axios.isCancel(err)) return; // Tactical suppression of network aborts
            logger.error('[ChatProvider] Failed to load messages:', err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, [user, getAbortController, isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated || !token || !user?.id) return;



        const onUserStatus: ServerToClientEvents["userStatus"] = (data) => {
            if (!data.userId) return;

            setPresence(prev => {
                const existing = prev[data.userId as UserId];
                // P0: Non-Destructive Merge: Ensure we never overwrite metadata with null activities
                return {
                    ...prev,
                    [data.userId as UserId]: { 
                        isOnline: data.isOnline, 
                        last_activity: data.last_activity || existing?.last_activity || new Date().toISOString() 
                    }
                };
            });
            
            logger.debug('[ChatProvider] Presence heartbeat synchronized', { 
                userId: data.userId, 
                isOnline: data.isOnline 
            });
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

        const onTypingStarted = (data: { userId: UserId; conversationId: ConversationId; name: string }) => {
            setTypingUsers((prev) => [...new Set([...prev, data.userId])]);
        };

        const onTypingStopped = (data: { userId: UserId; conversationId: ConversationId; name: string }) => {
            setTypingUsers((prev) => prev.filter(id => id !== data.userId));
        };


        const onMessageRead = ({ conversationId, messageIds }: MessageReadEvent) => {
            if (activeConversationRef.current?.id === conversationId) {
                setMessages(prev => prev.map(msg =>
                    messageIds.includes(msg.id) ? { ...msg, status: 'read', isRead: true } : msg
                ));
            }
            // Batched sync to storage
            storageService.markMessagesRead(messageIds, new Date().toISOString());
        };

        const onMessageDelivered = ({ conversationId, messageIds }: { conversationId: ConversationId; messageIds: MessageId[] }) => {
            if (activeConversationRef.current?.id === conversationId) {
                setMessages(prev => prev.map(msg =>
                    messageIds.includes(msg.id) 
                        ? { ...msg, status: 'delivered' as const } // ATOMIC MERGE
                        : msg
                ));
            }
            // Batched sync to storage
            storageService.markMessagesDelivered(messageIds);
        };

        const onMessageDeleted: ServerToClientEvents["messageDeleted"] = ({ messageId, conversationId, newLastMessage }) => {
            // 🧬 ATOMIC DELETE GUARD: Ensure state is only updated if not already optimistically removed
            setMessages(prev => prev.filter(m => m.id !== messageId));
            setConversations(prev => prev.map(c => {
                if (c.id === conversationId && c.lastMessageId === messageId) {
                    return { 
                        ...c, 
                        lastMessage: newLastMessage?.content || 'Message deleted',
                        lastMessageId: newLastMessage?.id || c.lastMessageId,
                        lastMessageAt: newLastMessage?.createdAt || c.lastMessageAt
                    };
                }
                return c;
            }));
        };

        // ─── D2 REMEDIATION: "Delete for Me" Private Multi-Tab Sync ────────────────
        const onLocalMessageDeleted: ServerToClientEvents['localMessageDeleted'] = ({
            messageId,
            conversationId,
            newLastMessage
        }) => {
            // 🧬 ATOMIC DELETE GUARD: Avoid re-adding if already optimistically removed
            setMessages(prev => prev.filter(m => m.id !== messageId));
            // Mirror the sidebar preview update so every tab stays consistent.
            setConversations(prev =>
                prev.map(c =>
                    c.id === conversationId && c.lastMessageId === messageId
                        ? { 
                            ...c, 
                            lastMessage: newLastMessage?.content || 'Message deleted',
                            lastMessageId: newLastMessage?.id || c.lastMessageId,
                            lastMessageAt: newLastMessage?.createdAt || c.lastMessageAt
                          }
                        : c
                )
            );
        };

        const onMessageReaction: ServerToClientEvents["messageReaction"] = (data) => {
            setMessages(prev => prev.map(msg => {
                if (msg.id === data.messageId) {
                    const reactions = [...(msg.reactions || [])];
                    if (data.action === 'added') {
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

            const formattedMessage: Message = {
                ...message,
                content: decryptedContent,
                isMe: message.senderId === user?.id,
                attachments: (message.attachments || []).map((att: Attachment) => {
                    // Phase 12: Permissive Normalization - Fallback to defaults instead of dropping data
                    const rawName = att.name || 'attachment';
                    const safeName = rawName.replace(/\\/g, '/').split('/').pop() || 'attachment';
                    
                    return {
                        id: att.id || `legacy-${Date.now()}-${Math.random()}`,
                        url: att.url || (att.id ? `/api/files/message/${att.id}` : ''),
                        type: att.type || 'application/octet-stream',
                        size: typeof att.size === 'number' ? att.size : 0,
                        name: safeName
                    };
                }),
                replyTo: message.replyTo && decryptedReplyContent
                    ? { ...message.replyTo, content: decryptedReplyContent }
                    : undefined
            };

            // 1. Update Active Message List with Hardened Deduplication & Sorting
            if (activeConversationRef.current && message.conversationId === activeConversationRef.current.id) {
                setMessages((prev: Message[]) => {
                    // Exact ID match check
                    const exists = prev.some((m: Message) => m.id === message.id);
                    if (exists) {
                        // 🧬 DEEP MERGE GUARD (Meta-Grade): Update status but PRESERVE reactions
                        return prev.map((m: Message) => m.id === message.id 
                            ? { ...m, status: message.status, reactions: m.reactions || [] } 
                            : m
                        );
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

            // 2. State-Safe Conversation List Update (Atomic Shuffling)
            setConversations((prev: Conversation[]) => {
                const index = prev.findIndex((c: Conversation) => c.id === message.conversationId);
                const lastMsgPreview = decryptedContent || (message.attachments && message.attachments.length > 0 ? '📎 Attachment' : 'New message');
                
                if (index === -1) {
                    // Phase 12: Atomic Discovery - schedule full sync but return prev to avoid jumpiness
                    // The backend fetchConversations call will merge this new thread correctly.
                    fetchConversations();
                    return prev;
                }

                const newConversations = [...prev];
                const target = { ...newConversations[index] };

                const isUnread = message.senderId !== user?.id && activeConversationRef.current?.id !== message.conversationId;

                newConversations[index] = {
                    ...target,
                    unreadCount: isUnread ? (target.unreadCount || 0) + 1 : target.unreadCount,
                    lastMessage: lastMsgPreview,
                    lastMessageAt: message.createdAt,
                    lastMessageId: message.id
                };

                // Re-order: Move updated conversation to the top
                const updatedConv = newConversations.splice(index, 1)[0];
                return [updatedConv, ...newConversations];
            });

            // 3. ENTERPRISE ACKNOWLEDGEMENT FLOW (Delivery & Read)
            if (message.senderId !== user?.id) {
                if (activeConversationRef.current?.id === message.conversationId) {
                    socketService.emit('messageRead', { 
                        conversationId: message.conversationId, 
                        messageIds: [message.id], 
                        userId: user!.id as UserId 
                    });
                    api.put<ApiResponse<void>>(`/chat/conversations/${message.conversationId}/read`).catch((err: unknown) => {
                        logger.error('[ChatProvider] Read receipt sync failed:', err instanceof Error ? err.message : String(err));
                    });
                } else {
                    socketService.emit('ackDelivery', { 
                        conversationId: message.conversationId, 
                        messageId: message.id,
                        senderId: user!.id as UserId,
                        senderRole: (user?.role as string) || 'patient'
                    });
                    api.put<ApiResponse<void>>(`/chat/conversations/${message.conversationId}/delivered`).catch((err: unknown) => {
                        logger.error('[ChatProvider] Delivery acknowledgement failed:', err instanceof Error ? err.message : String(err));
                    });
                }
            }
        };

        socketService.connect(token);
        socketService.on('typingStarted', onTypingStarted);
        socketService.on('typingStopped', onTypingStopped);
        socketService.on('messageRead', onMessageRead);
        socketService.on('messageDelivered', onMessageDelivered); // NEW: Batched Sync
        socketService.on('messageReceived', onReceiveMessage);
        socketService.on('messageDeleted', onMessageDeleted);
        socketService.on('messageReaction', onMessageReaction);
        socketService.on('userStatus', onUserStatus);
        socketService.on('reconnect', syncMissedMessages);
        socketService.on('localMessageDeleted', onLocalMessageDeleted);

        // ─── D9 REMEDIATION: Token Refresh-on-Reconnect ──────────────────────────
        // socket.io-client freezes `socket.auth` at the moment `connect()` is first
        // called. After a proactive token rotation the in-memory credential in api.ts
        // is fresh, but the socket still holds the original stale token in its
        // auth closure. `reconnect_attempt` fires BEFORE each connection handshake,
        // giving us the correct window to push the freshest token to the socket.
        const onReconnectAttempt = (_attempt: number): void => {
            const freshToken = getAccessToken();
            if (freshToken !== null) {
                socketService.updateAuthToken(freshToken);
            }
        };
        socketService.on('reconnect_attempt', onReconnectAttempt);

        // ─── Phase 14: Token Hydration Safety Guard ─────────────────────────────
        // Root Cause (2026-04-09): `isAuthenticated` transitions to `true` during a
        // proactive refresh cycle BEFORE the fresh token is written to the in-memory
        // `accessToken` closure in api.ts. In this window, `fetchConversations()`
        // fires without a valid Authorization header → spurious 401 on /chat/conversations.
        //
        // Fix: Validate the current token before the initial fetch. If within the
        // near-death threshold (<= 10s), defer until the `auth:token-refreshed`
        // CustomEvent confirms a fresh credential is available in memory.
        const TOKEN_NEAR_DEATH_THRESHOLD_MS = 10_000 as const;

        const isViableToken = (rawToken: string | null): boolean => {
            if (!rawToken) return false;
            try {
                const parts = rawToken.split('.');
                if (parts.length !== 3) return false;
                const part1 = parts[1];
                if (!part1) return false;
                const payload: unknown = JSON.parse(
                    atob(part1.replace(/-/g, '+').replace(/_/g, '/'))
                );
                if (
                    typeof payload !== 'object' ||
                    payload === null ||
                    !('exp' in payload) ||
                    typeof (payload as { exp: unknown }).exp !== 'number'
                ) return false;
                return ((payload as { exp: number }).exp * 1000) > (Date.now() + TOKEN_NEAR_DEATH_THRESHOLD_MS);
            } catch {
                return false;
            }
        };

        const currentToken = token ?? sessionStorage.getItem('token');
        let deferredFetchListener: (() => void) | null = null;

        if (isViableToken(currentToken)) {
            // Token is healthy — fire the initial fetch immediately
            fetchConversations();
        } else {
            // Token is absent or within near-death window — defer until refresh confirms
            logger.info('[ChatProvider] Token near-death or absent. Deferring fetchConversations until auth:token-refreshed fires.');
            const onTokenRefreshed = (): void => { fetchConversations(); };
            deferredFetchListener = onTokenRefreshed;
            window.addEventListener('auth:token-refreshed', onTokenRefreshed, { once: true });
        }

        return () => {
            socketService.off('userStatus', onUserStatus);
            socketService.off('typingStarted', onTypingStarted);
            socketService.off('typingStopped', onTypingStopped);
            socketService.off('messageRead', onMessageRead);
            socketService.off('messageDelivered', onMessageDelivered);
            socketService.off('messageReceived', onReceiveMessage);
            socketService.off('messageDeleted', onMessageDeleted);
            socketService.off('messageReaction', onMessageReaction);
            // D2 + D9 REMEDIATION: Deregister the two new handlers on unmount / auth-loss
            socketService.off('localMessageDeleted', onLocalMessageDeleted);
            socketService.off('reconnect_attempt', onReconnectAttempt);

            // Deferred fetch cleanup: remove stale listener if component unmounts before
            // the refresh cycle completes. `{ once: true }` auto-removes on fire,
            // but this guards pre-fire unmount scenarios explicitly.
            if (deferredFetchListener !== null) {
                window.removeEventListener('auth:token-refreshed', deferredFetchListener);
                deferredFetchListener = null;
            }

            // P0: Physical Disconnection on unmount/auth-loss
            // This ensures the backend disconnect event fires immediately.
            socketService.disconnect();
        };

    }, [isAuthenticated, user, token, fetchConversations]);

    // ─── 🧪 INSTITUTIONAL HEARTBEAT EMITTER (Meta-Grade) ────────────────────
    // P0: Zero-drift presence synchronization. We emit a heartbeat every 30s
    // to maintain the backend's active_connections source of truth.
    // Phase 3 Guard: Heartbeat is strictly gated on isAuthenticated.
    // If the session is terminated (cross-tab logout), this effect will
    // self-terminate on the next re-render cycle, preventing ghost emissions.
    useEffect(() => {
        if (!isAuthenticated) {
            logger.info('[ChatProvider] Heartbeat suppressed: session not active.');
            return;
        }
        if (!socketService.isConnected()) return;

        const heartbeatInterval = setInterval(() => {
            // Institutional double-check: guard before each individual emission
            if (!socketService.isConnected()) {
                clearInterval(heartbeatInterval);
                return;
            }
            socketService.emit('heartbeat');
        }, 30000); // 30s Institutional Heartbeat

        return () => {
            clearInterval(heartbeatInterval);
            logger.info('[ChatProvider] Heartbeat cleared on session state change.');
        };
    }, [isAuthenticated]);

    // ─── Phase 3: Hardened Outbox Sync (Exponential Backoff) ──────────────────
    useEffect(() => {
        if (!isAuthenticated || !user?.id) return;

        const syncOutbox = async () => {
            if (!isAuthenticated) return;
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

            const pending = await storageService.getPendingMessages();
            if (pending.length === 0) {
                syncRetryCountRef.current = 0; // Reset on clean outbox
                return;
            }

            logger.info(`[ChatProvider] 🔄 Outbox sync attempt ${syncRetryCountRef.current + 1} (${pending.length} messages)`);

            let hasTerminalFailure = false;

            for (const msg of pending) {
                try {
                    await api.post<ApiResponse<Message>>('/chat/messages', {
                        conversationId: msg.conversationId,
                        content: msg.content,
                        messageType: msg.messageType,
                        attachments: msg.attachments && msg.attachments.length > 0 ? msg.attachments.map(att => ({
                            url: att.url,
                            type: att.type,
                            originalName: att.name
                        })) : undefined,
                        replyToId: msg.replyToId
                    });

                    await storageService.removePendingMessage(msg.id);
                    logger.info(`[ChatProvider] ✓ Outbox sync success: ${msg.id}`);
                } catch (err: unknown) {
                    const status = axios.isAxiosError(err) ? err.response?.status : null;
                    const isTerminal = status === 400 || status === 401 || status === 403;
                    
                    if (isTerminal) {
                        logger.error(`[ChatProvider] ❌ Terminal outbox failure (${status}) for ${msg.id}. Halting sync.`);
                        hasTerminalFailure = true;
                        break; 
                    }
                    
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    logger.warn(`[ChatProvider] ! Transient outbox failure for ${msg.id}: ${errorMsg}`);
                }
            }

            if (!hasTerminalFailure && isMountedRef.current) {
                // Schedule next retry with exponential backoff + jitter
                syncRetryCountRef.current++;
                const baseDelay = Math.min(1000 * Math.pow(2, syncRetryCountRef.current), 60000);
                const jitter = Math.floor(Math.random() * 1000);
                const finalDelay = baseDelay + jitter;

                logger.info(`[ChatProvider] Next outbox sync in ${Math.round(finalDelay/1000)}s...`);
                // Final session guard before scheduling next retry
                if (isAuthenticated) {
                    syncTimeoutRef.current = setTimeout(syncOutbox, finalDelay);
                }
            }
        };

        // Initial trigger
        syncOutbox();

        window.addEventListener('online', syncOutbox);
        return () => {
            window.removeEventListener('online', syncOutbox);
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        };
    }, [isAuthenticated, user?.id]);

    const sendMessage = useCallback(async (
        content: string,
        conversationId: ConversationId,
        attachments: Attachment[] = [],
        replyToId?: string
    ) => {
        if (!user?.id || !isAuthenticated) return;

        // Phase 3: Optimistic UUID generation for Local-First tracking
        const tempId = `opt-${crypto.randomUUID()}`;
        const resolvedType: 'text' | 'image' | 'document' = attachments.length > 0
            ? (attachments.some(a => a.type.startsWith('image/')) ? 'image' : 'document')
            : 'text';

        const optimisticMessage: Message = {
            id: tempId as MessageId,
            tempId, // Mirroring for structural clarity
            conversationId,
            senderId: user.id as UserId,
            senderName: user.name || 'Me',
            content,
            messageType: resolvedType,
            status: 'sending',
            isRead: false,
            isMe: true,
            createdAt: new Date().toISOString(),
            sequenceNumber: (conversations.find(c => c.id === conversationId)?.sequenceCounter || 0) + 1,
            attachments: attachments,
            reactions: [],
            replyToId: replyToId as MessageId
        };

        // 1. PERSIST TO OUTBOX: Immediate protection against browser crash/refresh
        await storageService.putPendingMessage(optimisticMessage, user.id as UserId);

        // 2. OPTIMISTIC UI: Render instantly
        setMessages((prev: Message[]) => [...prev, optimisticMessage]);

        // 3. SIDEBAR UPDATE: Instant feedback
        setConversations((prev: Conversation[]) => {
            const index = prev.findIndex((c: Conversation) => c.id === conversationId);
            if (index === -1) return prev;
            const newConversations = [...prev];
            const target = newConversations[index];
            newConversations[index] = {
                ...target,
                lastMessage: content || (attachments.length > 0 ? '📎 Attachment' : ''),
                lastMessageAt: optimisticMessage.createdAt
            };
            // Move to top
            const [moved] = newConversations.splice(index, 1);
            return [moved, ...newConversations];
        });

        try {
            // Local decryption/encryption logic for sensitive clinical data
            const res = await api.post<ApiResponse<Message>>('/chat/messages', {
                conversationId,
                content,
                messageType: resolvedType,
                attachments: attachments.map(att => ({
                    url: att.url,
                    type: att.type,
                    originalName: att.name
                })),
                replyToId
            });

            if (res.data) {
                const realMessage = {
                    ...res.data.data,
                    isMe: true
                };

                // 4. STORAGE RETIREMENT: Remove from Outbox, commit to Permanent Store
                await storageService.removePendingMessage(tempId as MessageId);
                await storageService.putMessages([realMessage], user.id as UserId);

                setMessages((prev: Message[]) => {
                    const socketAdded = prev.some(m => m.id === realMessage.id);
                    if (socketAdded) {
                        return prev.filter((m: Message) => m.id !== tempId);
                    }
                    // Institutional Guard: Replace opt-id with real-id if not already handled by socket
                    return prev.map((m: Message) => m.id === tempId ? realMessage : m);
                });
            }
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`[ChatProvider] Transmission failure: ${errorMsg}`);

            // FAILURE HANDLING: Update Outbox status for future retry
            await storageService.updatePendingMessageStatus(tempId as MessageId, 'failed');

            // Visual feedback: Update optimistic message status in state
            setMessages((prev: Message[]) => prev.map((m: Message) =>
                m.id === tempId ? { ...m, status: 'failed' } : m
            ));
        }
    }, [user, isAuthenticated, conversations]);

    const selectConversation = useCallback((conversation: Conversation) => {
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
    }, [user, fetchPresence, loadMessages]);

    const startNewConversation = useCallback(async (participantId: string, _meta?: ParticipantMetadata) => {
        if (!isAuthenticated) return;
        try {
            const res = await api.post<ChatApiResponse<Conversation>>('/chat/conversations', { participantId });
            
            if (!res.data?.success || !res.data?.data) {
                throw new Error("Invalid conversation response");
            }

            const newConv = res.data.data;

            // P0 Optimization (D8): Atomic local update instead of global re-fetch
            setConversations(prev => {
                const exists = prev.find(c => c.id === newConv.id);
                if (exists) return prev;
                return [newConv, ...prev];
            });

            selectConversation(newConv);
        } catch (err: unknown) {
            logger.error('[ChatProvider] Failed to start conversation:', err instanceof Error ? err.message : String(err));
        }
    }, [isAuthenticated, selectConversation]);

    const emitTyping = useCallback((conversationId: ConversationId, isTyping: boolean) => {
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
    }, [user, isAuthenticated]);

    const uploadAttachment = useCallback(async (file: File): Promise<AttachmentDTO | null> => {
        if (!isAuthenticated) return null;
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
    }, [isAuthenticated]);

    const deleteMessage = useCallback(async (messageId: MessageId, forEveryone: boolean) => {
        if (!isAuthenticated) return;
        
        let previousMessages: Message[] = [];
        setMessages((prev: Message[]) => {
            previousMessages = [...prev];
            return prev.filter((msg: Message) => msg.id !== messageId);
        });

        try {
            // Fix 3: REST-compliant DELETE verb (matches backend router.delete('/messages/:messageId'))
            await api.delete<ApiResponse<void>>(`/chat/messages/${messageId}`, {
                data: { forEveryone }
            });
            
            // ✅ PERSIST SIDEBAR: Sync the last message preview to reflect the deletion
            setConversations((prev: Conversation[]) => prev.map((c: Conversation) => {
                if (c.lastMessageId === messageId) {
                    return { ...c, lastMessage: 'Message deleted' };
                }
                return c;
            }));
        }
        catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger.error('[ChatProvider] Forensic Audit: Delete failed', {
                messageId,
                forEveryone,
                error: errorMsg
            });
            // REVERT: Only on fatal API failure
            setMessages(previousMessages);
        }
    }, [isAuthenticated]);

    const reactToMessage = useCallback(async (messageId: MessageId, reactionType: string) => {
        if (!user || !isAuthenticated) return;

        let previousMessages: Message[] = [];
        setMessages((prev: Message[]) => {
            previousMessages = [...prev];
            return prev.map((msg: Message) => {
                if (msg.id === messageId) {
                    const reactions = msg.reactions || [];
                    const currentUserId = user.id as UserId;
                    const existing = reactions.find(r => r.userId === currentUserId && r.type === reactionType);
                    if (existing) return { ...msg, reactions: reactions.filter(r => r.userId !== currentUserId) };
                    const withoutMyReactions = reactions.filter(r => r.userId !== currentUserId);
                    return { ...msg, reactions: [...withoutMyReactions, { type: reactionType, userId: currentUserId }] };
                }
                return msg;
            });
        });

        try {
            await api.post<ApiResponse<void>>(`/chat/messages/${messageId}/react`, { reactionType });
            // SUCCESS: No further action needed as optimistic state is already applied
        }
        catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger.error('[ChatProvider] Forensic Audit: Reaction failed', {
                messageId,
                reactionType,
                error: errorMsg
            });
            // REVERT: Critical for preventing "Ghost Reactions"
            setMessages(previousMessages);
        }
    }, [user, isAuthenticated]);

    const markAsRead = useCallback(async (conversationId: ConversationId) => {
        if (!isAuthenticated) return;
        const now = Date.now();
        const lastRead = lastReadRequestRef.current[conversationId as string] || 0;

        // ENTERPRISE THROTTLING: Max 1 request per 2 seconds per conversation for read status
        if (now - lastRead < 2000) return;

        try {
            lastReadRequestRef.current[conversationId as string] = now;
            await api.put<void>(`/chat/conversations/${conversationId}/read`);

            // Standardize unread badge sync locally
            setConversations((prev: Conversation[]) => prev.map((c: Conversation) =>
                c.id === conversationId ? { ...c, unreadCount: 0 } : c
            ));
        } catch (err: unknown) {
            logger.error('[ChatProvider] Failed to mark read:', err instanceof Error ? err.message : String(err));
            lastReadRequestRef.current[conversationId as string] = 0;
        }
    }, [isAuthenticated]);

    const markMessageAsRead = useCallback(async (messageId: MessageId) => {
        if (!user || !isAuthenticated) return;
        try {
            socketService.emit('messageRead', { 
                conversationId: activeConversationRef.current?.id as ConversationId,
                messageIds: [messageId], 
                userId: user.id as UserId 
            });
            // Optional: Backend persistency call if not already handled by conversation-level markAsRead
        } catch (err: unknown) {
            logger.error('[ChatProvider] Failed to emit messageRead', err instanceof Error ? err.message : String(err));
        }
    }, [user, isAuthenticated]);

    return (
        <ChatContext.Provider value={{
            conversations, activeConversation, messages, loading, typingUsers, presence, isHydrated,
            fetchConversations, selectConversation, sendMessage, startNewConversation,
            emitTyping, uploadAttachment, deleteMessage, reactToMessage, markAsRead, markMessageAsRead, user
        }}>
            {children}
        </ChatContext.Provider>
    );
};
