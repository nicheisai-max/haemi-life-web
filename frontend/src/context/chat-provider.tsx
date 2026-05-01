import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChatContext } from './chat-context';
import { useAuth } from '../hooks/use-auth';
import api, { getAccessToken } from '../services/api';
import { decrypt, getTokenExp } from '../utils/security';
import { socketService, type ServerToClientEvents } from '../services/socket.service';
import { 
    Conversation, 
    Message, 
    Attachment, 
    AttachmentDTO,
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
import { usePresence } from '../hooks/use-presence';


/**
 * Single source of truth for visual message ordering across the chat
 * surface. The previous comparator keyed on `sequenceNumber` and used
 * `|| 0` for missing values — which silently coerced NULL-sequence rows
 * (e.g. messages inserted by seed scripts that bypass
 * `chatReliabilityService.getNextSequence`) to the lowest possible
 * value, sinking them to the *top* of an ascending sort and causing the
 * newest messages to render as the oldest in the thread.
 *
 * `createdAt` is server-monotonic and always present, so we key on it
 * primarily and use `sequenceNumber` only as a tiebreaker for messages
 * inserted in the same millisecond (e.g. same-batch fan-out). This
 * matches the canonical "time is truth" pattern used by WhatsApp /
 * iMessage and is robust against any partial-sequence drift in the DB.
 */
const compareMessagesForDisplay = (a: Message, b: Message): number => {
    const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    const seqA = typeof a.sequenceNumber === 'number' ? a.sequenceNumber : 0;
    const seqB = typeof b.sequenceNumber === 'number' ? b.sequenceNumber : 0;
    return seqA - seqB;
};


export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const { typingUsers, fetchPresence } = usePresence();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);
    // Backwards-pagination (older-message lazy load) state. Both reset
    // on conversation change inside loadMessages.
    const [hasMoreOlder, setHasMoreOlder] = useState(false);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    // Defensive check to ensure state is in scope for async handlers
    if (typeof typingUsers === 'undefined') {
        logger.warn('[ChatProvider] Emergency state recovery triggered');
    }
    const activeConversationRef = useRef<Conversation | null>(null);
    const lastSyncRef = useRef<string>(new Date().toISOString());
    const lastReadRequestRef = useRef<Record<string, number>>({});
    const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
    const isMountedRef = useRef(true);
    const syncRetryCountRef = useRef<number>(0);
    const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSequenceRef = useRef<number>(0);
    // BUG-8 FIX: conversationsRef allows syncPresenceFallback to read the current
    // conversations list WITHOUT being included in its dependency array.
    const conversationsRef = useRef<Conversation[]>([]);
    // BUG-5 FIX: Ref-backed debouncer for fetchConversations triggered by unknown
    // conversation discovery. Absorbs rapid message bursts.
    const fetchConversationsDebouncedRef = useRef<NodeJS.Timeout | null>(null);
    // Lets loadOlderMessages read the current oldest sequence without
    // depending on `messages` in the callback dep array.
    const messagesRef = useRef<Message[]>([]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // BUG-8 FIX: Keep conversationsRef in sync with conversations state.
    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    // Mirror `messages` into a ref so loadOlderMessages can read the
    // current oldest sequence without re-creating on every state change.
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

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
                            await storageService.removePendingMessage(msg.id);
                        }
                    }
                }

                const localConversations = await storageService.getAllConversations();
                if (localConversations.length > 0 && isMountedRef.current) {
                    setConversations(localConversations);
                    logger.info(`[ChatProvider] Hydrated ${localConversations.length} conversations from IndexedDB`);
                    
                    // Fetch presence for hydrated participants
                    const partIds = [...new Set(localConversations.flatMap(c => c.participants.map(p => p.id)))];
                    if (partIds.length > 0) fetchPresence(partIds);

                    // 🧬 SEED SEQUENCE CURSOR (Meta-Grade)
                    const maxSeq = await storageService.getGlobalMaxSequenceNumber();
                    lastSequenceRef.current = maxSeq;
                    logger.debug(`[ChatProvider] Sequence cursor seeded: ${maxSeq}`);
                }
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : 'Institutional data breach or persistence failure';
                logger.error('[ChatProvider] Hydration failed', errorMessage);
            }
        };

        hydrate();
    }, [isAuthenticated, user?.id, fetchPresence]);



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

            // P0: Forensic Deduplication by Participant Hash (Double Guard)
            // Ensures that even if the backend returns duplicate threads, the UI only shows
            // the most active one per participant pair.
            const uniqueByHash = new Map<string, Conversation>();
            decryptedConversations.forEach((c: Conversation) => {
                const hash = c.participantsHash;
                const existing = uniqueByHash.get(hash);
                if (!existing || (new Date(c.lastMessageAt).getTime() > new Date(existing.lastMessageAt).getTime())) {
                    uniqueByHash.set(hash, c);
                }
            });
            const uniqueConversations = Array.from(uniqueByHash.values());

            setConversations(uniqueConversations);
            setIsHydrated(true); // ✅ Certification of source parity (Meta-Grade)
            setLoading(false); // ✅ Ensure global loader resolves on success

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

            return uniqueConversations;
        } catch (err: unknown) {
            if (axios.isCancel(err)) return; 
            const errorMessage = err instanceof Error ? err.message : 'Network layer synchronization failure';
            logger.error('[ChatProvider] Failed to fetch conversations', errorMessage);
            if (isMountedRef.current) {
                setLoading(false);
                setIsHydrated(true); 
            }
        }
    }, [isAuthenticated, fetchPresence, getAbortController]);

    const fetchConversations = useCallback(async (): Promise<void> => {
        await internalFetchConversations();
    }, [internalFetchConversations]);

    const loadMessages = useCallback(async (conversationId: ConversationId) => {
        if (!isAuthenticated) return;
        setLoading(true);
        // Reset backwards-pagination state on every fresh conversation
        // load. The new conversation's `hasMore` is reasserted by the API
        // response below.
        setHasMoreOlder(false);
        setIsLoadingOlder(false);
        const controller = getAbortController(`loadMessages:${conversationId}`);

        try {
            // 1. Local-First: Load from IndexedDB immediately
            const localMessages = await storageService.getMessagesByConversation(conversationId);
            if (localMessages.length > 0 && isMountedRef.current) {
                setMessages(localMessages);
                // Background task: delivered/read status updates can happen later
            }

            // 2. Fetch latest paginated batch from API
            const res = await api.get<{ data: { messages: Message[]; hasMore: boolean } }>(
                `/chat/messages/${conversationId}?limit=50`,
                { signal: controller.signal }
            );
            const payload: unknown = res.data;

            const isMessagesPagePayload = (v: unknown): v is { data: { messages: Message[]; hasMore: boolean } } => {
                if (typeof v !== 'object' || v === null) return false;
                if (!('data' in v)) return false;
                const wrapper = v as { data: unknown };
                if (typeof wrapper.data !== 'object' || wrapper.data === null) return false;
                const obj = wrapper.data as { messages?: unknown; hasMore?: unknown };
                return Array.isArray(obj.messages) && typeof obj.hasMore === 'boolean';
            };

            if (!isMessagesPagePayload(payload)) {
                throw new Error('Invalid messages response shape');
            }

            const data = payload.data.messages;
            const hasMore = payload.data.hasMore;
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

            const sortedMessages = formattedMessages.slice().sort(compareMessagesForDisplay);

            // P1 FIX: Prevent race condition if user switched conversation during load
            if (activeConversationRef.current?.id !== conversationId && conversationId !== 'sync') return;

            setMessages(sortedMessages);
            setHasMoreOlder(hasMore);

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

    /**
     * Backwards-pagination loader. Idempotent while a request is in
     * flight; bails when the backend has already reported no further
     * older messages. Reads the current oldest sequence from a ref so
     * the callback identity is stable across message-state updates.
     */
    const loadOlderMessages = useCallback(async (conversationId: ConversationId): Promise<void> => {
        if (!isAuthenticated) return;
        if (isLoadingOlder || !hasMoreOlder) return;

        const current = messagesRef.current;
        if (current.length === 0) return;

        // Find the oldest in-memory sequence to use as the cursor.
        let oldestSeq = Number.POSITIVE_INFINITY;
        for (const m of current) {
            const seq = typeof m.sequenceNumber === 'number' ? m.sequenceNumber : 0;
            if (seq > 0 && seq < oldestSeq) oldestSeq = seq;
        }
        if (!Number.isFinite(oldestSeq)) return;

        const controller = getAbortController(`loadOlder:${conversationId}`);
        setIsLoadingOlder(true);

        try {
            const res = await api.get<{ data: { messages: Message[]; hasMore: boolean } }>(
                `/chat/messages/${conversationId}?before=${oldestSeq}&limit=50`,
                { signal: controller.signal }
            );
            const payload: unknown = res.data;

            const isMessagesPagePayload = (v: unknown): v is { data: { messages: Message[]; hasMore: boolean } } => {
                if (typeof v !== 'object' || v === null) return false;
                if (!('data' in v)) return false;
                const wrapper = v as { data: unknown };
                if (typeof wrapper.data !== 'object' || wrapper.data === null) return false;
                const obj = wrapper.data as { messages?: unknown; hasMore?: unknown };
                return Array.isArray(obj.messages) && typeof obj.hasMore === 'boolean';
            };

            if (!isMessagesPagePayload(payload)) {
                throw new Error('Invalid older-messages response shape');
            }

            const olderRaw = payload.data.messages;
            const olderHasMore = payload.data.hasMore;

            const formatted = await Promise.all(
                olderRaw.map(async (msg: Message): Promise<Message> => ({
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
            );

            // Bail if the user navigated away during the fetch.
            if (!isMountedRef.current) return;
            if (activeConversationRef.current?.id !== conversationId) return;

            // Stable sort by sequence (chronological ASC). Prepend ahead
            // of existing messages; deduplicate on id so a server replay
            // of an already-known message does not produce a duplicate.
            const knownIds = new Set(messagesRef.current.map(m => m.id));
            const fresh = formatted.filter(m => !knownIds.has(m.id));
            if (fresh.length === 0) {
                setHasMoreOlder(olderHasMore);
                return;
            }

            const sortedFresh = fresh.slice().sort(compareMessagesForDisplay);

            setMessages(prev => [...sortedFresh, ...prev]);
            setHasMoreOlder(olderHasMore);

            if (user?.id) {
                storageService.putMessages(sortedFresh, user.id as UserId).catch((persistErr: unknown) => {
                    const detail = persistErr instanceof Error ? persistErr.message : String(persistErr);
                    logger.error('[ChatProvider] Older-message persistence failed', { error: detail });
                });
            }
        } catch (err: unknown) {
            if (axios.isCancel(err)) return;
            const detail = err instanceof Error ? err.message : String(err);
            logger.error('[ChatProvider] loadOlderMessages failed', { error: detail, conversationId });
        } finally {
            setIsLoadingOlder(false);
        }
    }, [isAuthenticated, isLoadingOlder, hasMoreOlder, user, getAbortController]);

    useEffect(() => {
        if (!isAuthenticated || !user?.id || !getAccessToken()) return;





        const syncMissedMessages = async (): Promise<void> => {
            try {
                // 🧬 DELTA SYNC PROTOCOL: Request messages since the last known sequence ID
                const res = await api.get<{ data: Message[] } | Message[]>(
                    `/chat/sync?lastSeqId=${lastSequenceRef.current}&since=${lastSyncRef.current}`
                );
                
                const payload = res.data;
                if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data: unknown }).data)) {
                    throw new Error('Invalid delta sync response');
                }

                const missedMessages: Message[] = (payload as { data: Message[] }).data;

                if (missedMessages.length > 0) {
                    logger.info(`[ChatProvider] Delta Recovery: Found ${missedMessages.length} messages.`);
                    for (const msg of missedMessages) {
                        await onReceiveMessage(msg);
                    }
                }
                
                // Advance cursors
                lastSyncRef.current = new Date().toISOString();
                logger.debug('[ChatProvider] Sync cursors advanced', { 
                    time: lastSyncRef.current, 
                    seq: lastSequenceRef.current 
                });
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Delta recovery handshake failed';
                logger.error('[ChatProvider] Offline recovery failed', msg);
            }
        };




        // BUG-3 FIX: activeConversationRef guard REMOVED.
        // setMessages is always safe to call: .map() over a list with no matching
        // message IDs is a no-op — zero side effects when conversation is not active.
        const onMessageRead = ({ messageIds }: MessageReadEvent): void => {
            setMessages((prev: Message[]) => prev.map((msg: Message) =>
                messageIds.includes(msg.id) ? { ...msg, status: 'read' as const, isRead: true } : msg
            ));
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

        // The async body is split out so the listener itself can return
        // synchronously to the dispatch loop. Two reasons this matters:
        //
        //   1. When a follower tab receives this event via BroadcastChannel,
        //      the BC `onmessage` handler is a *native* browser event whose
        //      synchronous span is what Chrome times for the
        //      `[Violation] 'message' handler took Xms` warning. Returning
        //      immediately keeps that span sub-millisecond.
        //
        //   2. React 18 only auto-batches setState calls inside React-managed
        //      events; native `message` events are excluded. Running the
        //      cascade inside a `queueMicrotask` puts it in a context where
        //      the multiple `setMessages` / `setConversations` / `setUnread`
        //      calls below coalesce into a single render commit.
        //
        // Decryption is parallelised with `Promise.all` — the content and
        // reply-content paths are independent, so awaiting them serially was
        // doubling latency for every reply.
        const processIncomingMessage = async (message: Message): Promise<void> => {
            const [decryptedContent, decryptedReplyContent] = await Promise.all([
                decrypt(message.content),
                message.replyTo
                    ? decrypt(message.replyTo.content)
                    : Promise.resolve<string | undefined>(undefined),
            ]);

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

                    return newMessages.slice().sort(compareMessagesForDisplay);
                });
            }

            // 2. State-Safe Conversation List Update (Atomic Shuffling)
            setConversations((prev: Conversation[]) => {
                const index = prev.findIndex((c: Conversation) => c.id === message.conversationId);
                const lastMsgPreview = decryptedContent || (message.attachments && message.attachments.length > 0 ? '📎 Attachment' : 'New message');
                
                if (index === -1) {
                    // BUG-5 FIX: Unknown conversation discovered. Schedule debounced full-sync
                    // (500ms window) to absorb rapid burst scenarios (multiple messages from
                    // same new thread). Ref-backed debouncer prevents N concurrent fetches.
                    logger.info('[ChatProvider] Unknown conversation discovered. Scheduling debounced sync.', {
                        conversationId: message.conversationId
                    });
                    if (fetchConversationsDebouncedRef.current !== null) {
                        clearTimeout(fetchConversationsDebouncedRef.current);
                    }
                    fetchConversationsDebouncedRef.current = setTimeout((): void => {
                        fetchConversationsDebouncedRef.current = null;
                        fetchConversations();
                    }, 500);
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
                        userId: user.id as UserId 
                    });
                    api.put<ApiResponse<void>>(`/chat/conversations/${message.conversationId}/read`).catch((err: unknown) => {
                        logger.error('[ChatProvider] Read receipt sync failed:', err instanceof Error ? err.message : String(err));
                    });
                } else {
                    socketService.emit('ackDelivery', {
                        conversationId: message.conversationId,
                        messageId: message.id,
                        senderId: user.id as UserId,
                        // `user.role` is already the typed `UserRole` union;
                        // nullish-coalesce is sufficient and the previous
                        // `as string` widening cast was redundant.
                        senderRole: user?.role ?? 'patient'
                    });
                    api.put<ApiResponse<void>>(`/chat/conversations/${message.conversationId}/delivered`).catch((err: unknown) => {
                        logger.error('[ChatProvider] Delivery acknowledgement failed:', err instanceof Error ? err.message : String(err));
                    });
                }
            }
        };

        const onReceiveMessage: ServerToClientEvents["messageReceived"] = (message) => {
            // Sequence-cursor advance must stay synchronous so subsequent
            // gap-detection in `syncMissedMessages` sees the latest known
            // sequence even if state cascades are still queued.
            if (typeof message.sequenceNumber === 'number' && message.sequenceNumber > lastSequenceRef.current) {
                lastSequenceRef.current = message.sequenceNumber;
            }
            // Defer the decrypt + state cascade out of the event-dispatch
            // call stack. See `processIncomingMessage` doc-comment for why.
            queueMicrotask(() => {
                processIncomingMessage(message).catch((err: unknown) => {
                    const detail = err instanceof Error ? err.message : String(err);
                    logger.error('[ChatProvider] processIncomingMessage failed', {
                        error: detail,
                        messageId: message.id,
                    });
                });
            });
        };

        // ─── Phase 16: Institutional Socket Integration (Google/Meta Grade) ───
        // Root Cause Remediation: connection logic is now delegated to the 
        // socketService singleton. This effect focuses EXCLUSIVELY on 
        // listener orchestration.

        const onReconnectAttempt = (_attempt: number): void => {
            const freshToken = getAccessToken();
            if (freshToken !== null) {
                socketService.updateAuthToken(freshToken);
            }
        };

        const onReconnect = (): void => {
            syncMissedMessages();
        };

        // Hoist listeners BEFORE connection to prevent ReferenceErrors during sync/connect
        socketService.on('messageRead', onMessageRead);
        socketService.on('messageDelivered', onMessageDelivered);
        socketService.on('messageReceived', onReceiveMessage);
        socketService.on('messageDeleted', onMessageDeleted);
        socketService.on('messageReaction', onMessageReaction);
        socketService.on('reconnect', onReconnect);
        socketService.on('localMessageDeleted', onLocalMessageDeleted);
        socketService.on('reconnect_attempt', onReconnectAttempt);

        // Atomic Connection Initiation. The service reads the in-memory
        // access token at call time and defers internally if absent, so
        // the effect no longer needs to depend on `token`.
        socketService.connect().catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Socket handshake aborted';
            logger.error('[ChatProvider] Connection failure', msg);
        });

        const currentToken = getAccessToken() ?? sessionStorage.getItem('token');
        let deferredFetchFired = false;
        const onTokenRefreshed = (): void => {
            if (deferredFetchFired) return;
            deferredFetchFired = true;
            fetchConversations();
        };

        // Token-decode is delegated to the shared, memoised
        // `getTokenExp` helper so we don't pay the `atob + JSON.parse`
        // cost on every effect re-mount. The viability threshold stays
        // here because different callers (chat handshake vs background
        // refresh) may want different "near-death" windows.
        const TOKEN_NEAR_DEATH_THRESHOLD_MS = 10_000;
        const isViableToken = (rawToken: string | null): boolean => {
            const exp = getTokenExp(rawToken);
            if (exp === null) return false;
            return (exp * 1000) > (Date.now() + TOKEN_NEAR_DEATH_THRESHOLD_MS);
        };

        if (isViableToken(currentToken)) {
            fetchConversations();
        } else {
            logger.info('[ChatProvider] Token near-death. Deferring fetchConversations.');
            window.addEventListener('auth:token-refreshed', onTokenRefreshed, { once: true });
        }

        return () => {
            socketService.off('messageRead', onMessageRead);
            socketService.off('messageDelivered', onMessageDelivered);
            socketService.off('messageReceived', onReceiveMessage);
            socketService.off('messageDeleted', onMessageDeleted);
            socketService.off('messageReaction', onMessageReaction);
            socketService.off('localMessageDeleted', onLocalMessageDeleted);
            socketService.off('reconnect', onReconnect);
            socketService.off('reconnect_attempt', onReconnectAttempt);

            if (!deferredFetchFired) {
                window.removeEventListener('auth:token-refreshed', onTokenRefreshed);
            }

            // Phase A: do NOT destroy() the singleton here. Effect cleanup
            // fires on dependency change (e.g. user object replacement on
            // every commitAuthState) — destroying the BroadcastChannel and
            // listeners would permanently break cross-tab coordination.
            // `destroy()` is reserved for full app shutdown.
        };

    }, [isAuthenticated, user, fetchConversations]);


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
            // Wire `senderRole` through optimistic + reconciled state so the
            // bubble's typed role survives the socket round-trip without a
            // visual flicker on confirmation. `user.role` is the typed
            // `UserRole` union — assignable to `SenderRole` directly via
            // narrowing cast on the role-matched subset.
            senderRole: user.role,
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
                const realMessage: Message = {
                    ...res.data.data,
                    isMe: true
                };

                // 🧬 Advance Sequence Cursor
                if (realMessage.sequenceNumber && realMessage.sequenceNumber > lastSequenceRef.current) {
                    lastSequenceRef.current = realMessage.sequenceNumber;
                }

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

    const markAsRead = useCallback(async (conversationId: ConversationId): Promise<void> => {
        if (!isAuthenticated) return;
        const now: number = Date.now();
        const lastRead: number = lastReadRequestRef.current[conversationId as string] ?? 0;

        // ENTERPRISE THROTTLING: Max 1 request per 2 seconds per conversation
        if (now - lastRead < 2000) return;

        try {
            lastReadRequestRef.current[conversationId as string] = now;
            await api.put<void>(`/chat/conversations/${conversationId}/read`);

            // BUG-2 FIX: Locally update non-sender message statuses to 'read' immediately
            // after PUT succeeds. Eliminates visible grey-tick delay window.
            setMessages((prev: Message[]) => prev.map((m: Message) =>
                !m.isMe ? { ...m, status: 'read' as const, isRead: true } : m
            ));

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
            conversations, activeConversation, messages, loading, isHydrated,
            isLoadingOlder, hasMoreOlder,
            fetchConversations, selectConversation, sendMessage, startNewConversation,
            uploadAttachment, deleteMessage, reactToMessage, markAsRead, markMessageAsRead,
            loadOlderMessages, user
        }}>
            {children}
        </ChatContext.Provider>
    );
};
