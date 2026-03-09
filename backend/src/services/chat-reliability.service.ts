import { pool } from '../config/db';

interface ParticipantCache {
    [conversationId: string]: {
        userIds: string[];
        timestamp: number;
    };
}

class ChatReliabilityService {
    private static instance: ChatReliabilityService;
    private participantCache: ParticipantCache = {};
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
        const result = await pool.query(
            `UPDATE conversations 
             SET sequence_counter = COALESCE(sequence_counter, 0) + 1 
             WHERE id = $1 
             RETURNING sequence_counter`,
            [conversationId]
        );

        if (result.rows.length === 0) {
            throw new Error('Conversation not found');
        }

        return parseInt(result.rows[0].sequence_counter);
    }

    /**
     * Optimized participant lookup with in-memory caching.
     */
    public async getParticipants(conversationId: string): Promise<string[]> {
        const now = Date.now();
        const cached = this.participantCache[conversationId];

        if (cached && (now - cached.timestamp < this.CACHE_TTL)) {
            return cached.userIds;
        }

        const result = await pool.query(
            'SELECT user_id FROM conversation_participants WHERE conversation_id = $1',
            [conversationId]
        );

        const userIds = result.rows.map(r => r.user_id);
        this.participantCache[conversationId] = {
            userIds,
            timestamp: now
        };

        return userIds;
    }

    /**
     * Invalidate cache on membership change.
     */
    public invalidateCache(conversationId: string) {
        delete this.participantCache[conversationId];
    }
}

export const chatReliabilityService = ChatReliabilityService.getInstance();
