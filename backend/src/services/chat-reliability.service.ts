import { pool } from '../config/db';
import { logger } from '../utils/logger';


class ChatReliabilityService {
    private static instance: ChatReliabilityService;
    private participantCache: Map<string, { userIds: string[]; timestamp: number }> = new Map();
    private userConversationsCache: Map<string, { convIds: string[]; timestamp: number }> = new Map();
    private MAX_CACHE_SIZE = 1000;
    private CACHE_TTL = 300000; // 5 minutes

    private constructor() { }

    public static getInstance(): ChatReliabilityService {
        if (!ChatReliabilityService.instance) {
            ChatReliabilityService.instance = new ChatReliabilityService();
        }
        return ChatReliabilityService.instance;
    }

    /**
     * Gets the next sequence number for a conversation.
     * Uses a database lock (UPDATE) to ensure strict monotonicity.
     */
    public async getNextSequence(conversationId: string): Promise<number> {
        try {
            const result = await pool.query(
                `UPDATE conversations 
                 SET sequence_counter = COALESCE(sequence_counter, 0) + 1 
                 WHERE id = $1 
                 RETURNING sequence_counter`,
                [conversationId]
            );

            if (result.rows.length === 0) {
                logger.error('[ChatReliability] Sequence update failed: Conversation not found', { conversationId });
                throw new Error('Conversation not found');
            }

            const seq = parseInt(result.rows[0].sequence_counter);
            logger.info('[ChatReliability] Sequence generated', { conversationId, sequenceNumber: seq });
            return seq;
        } catch (error: unknown) {
            logger.error('[ChatReliability] Fatal error in getNextSequence', { 
                conversationId, 
                error: error instanceof Error ? error.message : String(error) 
            });
            throw error;
        }
    }

    /**
     * Optimized participant lookup with in-memory caching.
     */
    public async getParticipants(conversationId: string): Promise<string[]> {
        const now = Date.now();
        const cached = this.participantCache.get(conversationId);

        if (cached && (now - cached.timestamp < this.CACHE_TTL)) {
            return cached.userIds;
        }

        try {
            const result = await pool.query<{ user_id: string }>(
                'SELECT user_id FROM conversation_participants WHERE conversation_id = $1',
                [conversationId]
            );

            const userIds = result.rows.map(r => r.user_id);
            
            // Bounded Cache Eviction (FIFO-style for Maps)
            if (this.participantCache.size >= this.MAX_CACHE_SIZE) {
                const firstKey = this.participantCache.keys().next().value;
                if (firstKey) this.participantCache.delete(firstKey);
            }

            this.participantCache.set(conversationId, {
                userIds,
                timestamp: now
            });

            return userIds;
        } catch (error: unknown) {
            logger.error('[ChatReliability] Failed to get participants', {
                conversationId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Invalidate cache on membership change.
     */
    public invalidateCache(conversationId: string, userId?: string) {
        this.participantCache.delete(conversationId);
        if (userId) {
            this.userConversationsCache.delete(userId);
        }
        logger.info('[ChatReliability] Cache invalidated', { conversationId, userId });
    }

    /**
     * Gets all conversation IDs for a specific user.
     * Uses a short-lived cache to avoid redundant DB pressure during rapid presence events.
     */
    public async getUserConversations(userId: string): Promise<string[]> {
        const now = Date.now();
        const cached = this.userConversationsCache.get(userId);

        if (cached && (now - cached.timestamp < this.CACHE_TTL)) {
            return cached.convIds;
        }

        try {
            const result = await pool.query<{ conversation_id: string }>(
                'SELECT conversation_id FROM conversation_participants WHERE user_id = $1',
                [userId]
            );

            const convIds = result.rows.map(r => String(r.conversation_id));

            // Bounded Cache Eviction
            if (this.userConversationsCache.size >= this.MAX_CACHE_SIZE) {
                const firstKey = this.userConversationsCache.keys().next().value;
                if (firstKey) this.userConversationsCache.delete(firstKey);
            }

            this.userConversationsCache.set(userId, {
                convIds,
                timestamp: now
            });

            return convIds;
        } catch (error: unknown) {
            logger.error('[ChatReliability] Failed to get user conversations', {
                userId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Gets all unique user IDs that share a conversation with the given user.
     * Essential for targeted presence broadcasts (WhatsApp-grade privacy/performance).
     */
    public async getConversationPartners(userId: string): Promise<string[]> {
        try {
            const result = await pool.query<{ user_id: string }>(
                `SELECT DISTINCT user_id 
                 FROM conversation_participants 
                 WHERE conversation_id IN (
                     SELECT conversation_id 
                     FROM conversation_participants 
                     WHERE user_id = $1
                 ) AND user_id != $1`,
                [userId]
            );

            return result.rows.map(r => String(r.user_id));
        } catch (error: unknown) {
            logger.error('[ChatReliability] Failed to get conversation partners', {
                userId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Gets the conversation ID for a specific message ID.
     */
    public async getConversationIdByMessageId(messageId: string): Promise<string | null> {
        try {
            const result = await pool.query<{ conversation_id: string }>(
                'SELECT conversation_id FROM messages WHERE id = $1',
                [messageId]
            );

            if (result.rows.length === 0) return null;
            return String(result.rows[0].conversation_id);
        } catch (error: unknown) {
            logger.error('[ChatReliability] Failed to get conversation ID by message ID', {
                messageId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
}

export const chatReliabilityService = ChatReliabilityService.getInstance();
