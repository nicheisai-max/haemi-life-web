import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/use-auth';
import { socketService, type ServerToClientEvents } from '../services/socket.service';
import { 
    PresenceRecord, 
    PresenceApiResponse, 
    UserId, 
    ConversationId
} from '../types/chat';
import { logger } from '../utils/logger';
import api from '../services/api';
import { storageService } from '../services/storage.service';

// 🧬 INSTITUTIONAL TYPE SYSTEM: Presence Context (Meta-Grade)
import { PresenceContext } from './presence-context-def';


export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const [presence, setPresence] = useState<Record<UserId, PresenceRecord>>({});
    const [typingUsers, setTypingUsers] = useState<UserId[]>([]);
    
    const fetchPresenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const activePresenceRequestRef = useRef<Promise<void> | null>(null);
    const pendingPresenceIdsRef = useRef<Set<UserId>>(new Set());
    const isMounted = useRef(true);

    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isTypingRef = useRef<boolean>(false);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    // ─── 1. FETCH PRESENCE: Debounced & Batch-Optimized ───────────────────────
    const fetchPresence = useCallback(async (userIds: UserId[]) => {
        if (!isAuthenticated || !userIds || userIds.length === 0) return;

        userIds.forEach(id => pendingPresenceIdsRef.current.add(String(id) as UserId));

        if (fetchPresenceTimeoutRef.current) clearTimeout(fetchPresenceTimeoutRef.current);

        fetchPresenceTimeoutRef.current = setTimeout(async () => {
            if (!isAuthenticated || !isMounted.current) return;
            if (activePresenceRequestRef.current) return;

            const idsToFetch = Array.from(pendingPresenceIdsRef.current);
            if (idsToFetch.length === 0) return;

            pendingPresenceIdsRef.current.clear();

            try {
                const doFetch = async (): Promise<void> => {
                    const res = await api.get<PresenceApiResponse | Record<string, PresenceRecord>>(
                        `/chat/presence?userIds=${idsToFetch.join(',')}`
                    );

                    if (res.data && isMounted.current) {
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
                        
                        storageService.putPresence(actualPayload).catch((e: unknown) => {
                            logger.error('[PresenceProvider] Persistence failed', e instanceof Error ? e.message : String(e));
                        });
                    }
                };

                activePresenceRequestRef.current = doFetch();
                await activePresenceRequestRef.current;
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Institutional presence sync failed';
                logger.error('[PresenceProvider] Failed to fetch presence', msg);
                // DELIBERATE: no per-call user-facing toast here.
                //
                // Presence fetches fire frequently (every chat-list scroll,
                // every conversation open, every typing indicator burst).
                // Surfacing a toast on each transient failure would
                // overwhelm the notification surface and train the user
                // to ignore it — the opposite of what an error toast is
                // for.
                //
                // Sustained presence failures are already covered by the
                // umbrella `haemi:backend-down` signal raised by the
                // axios circuit breaker (`api.ts` recordFailure) and the
                // socket-service sustained-reconnect threshold. The
                // NetworkStatusProvider banner provides the aggregate
                // "service is having trouble" feedback without
                // per-request noise. Individual stale-presence blips
                // degrade gracefully (online dot may briefly show as
                // offline) without UI alarm — the WhatsApp / Slack
                // pattern.
            } finally {
                activePresenceRequestRef.current = null;
            }
        }, 300);
    }, [isAuthenticated]);

    // ─── 2. TYPING ORCHESTRATION: Socket Signaling ─────────────────────────────
    const emitTyping = useCallback((conversationId: ConversationId, isTyping: boolean) => {
        if (!isAuthenticated || !user?.id) return;
        
        if (isTyping && !isTypingRef.current) {
            socketService.emit('typingStarted', { 
                conversationId, 
                name: user.name 
            });
            isTypingRef.current = true;
        } else if (!isTyping && isTypingRef.current) {
            socketService.emit('typingStopped', { 
                conversationId, 
                name: user.name 
            });
            isTypingRef.current = false;
        }

        if (isTyping) {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                if (isMounted.current) {
                    socketService.emit('typingStopped', { 
                        conversationId, 
                        name: user.name 
                    });
                    isTypingRef.current = false;
                }
            }, 3000);
        }
    }, [isAuthenticated, user]);

    // ─── 3. SOCKET LISTENERS: Presence & Typing ────────────────────────────────
    useEffect(() => {
        if (!isAuthenticated || !user?.id) return;

        const onUserStatus: ServerToClientEvents["userStatus"] = (data) => {
            if (!data.userId) return;
            setPresence(prev => {
                const existing = prev[data.userId as UserId];
                return {
                    ...prev,
                    [data.userId as UserId]: { 
                        isOnline: data.isOnline, 
                        lastActivity: data.lastActivity ?? existing?.lastActivity ?? new Date().toISOString()
                    }
                };
            });
        };

        // Both handlers return the previous reference unchanged when the
        // incoming event would not alter the set. React shallow-compares
        // setter return values against the current state and *skips the
        // re-render entirely* when the reference is identical. Without this
        // guard, every `typingStarted` keystroke from N concurrent typists
        // re-renders the entire presence subtree even when the membership
        // set hasn't changed — a quiet O(N × keystrokes) waste.
        const onTypingStarted = (data: { userId: UserId }): void => {
            setTypingUsers((prev) => (
                prev.includes(data.userId) ? prev : [...prev, data.userId]
            ));
        };

        const onTypingStopped = (data: { userId: UserId }): void => {
            setTypingUsers((prev) => (
                prev.includes(data.userId) ? prev.filter(id => id !== data.userId) : prev
            ));
        };

        socketService.on('userStatus', onUserStatus);
        socketService.on('typingStarted', onTypingStarted);
        socketService.on('typingStopped', onTypingStopped);

        return () => {
            socketService.off('userStatus', onUserStatus);
            socketService.off('typingStarted', onTypingStarted);
            socketService.off('typingStopped', onTypingStopped);
        };
    }, [isAuthenticated, user?.id]);

    // ─── 4. INSTITUTIONAL HEARTBEAT ───────────────────────────────────────────
    useEffect(() => {
        if (!isAuthenticated || !user?.id) return;

        const heartbeatInterval = setInterval((): void => {
            if (socketService.isConnected()) {
                socketService.emit('heartbeat');
            }
        }, 30000);

        return () => clearInterval(heartbeatInterval);
    }, [isAuthenticated, user?.id]);

    const value = React.useMemo(() => ({
        presence,
        typingUsers,
        fetchPresence,
        emitTyping
    }), [presence, typingUsers, fetchPresence, emitTyping]);

    return (
        <PresenceContext.Provider value={value}>
            {children}
        </PresenceContext.Provider>
    );
};

