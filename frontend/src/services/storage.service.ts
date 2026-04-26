// ============================================================
// HAEMI LIFE — CLIENT-SIDE PERSISTENT STORAGE (Phase 3)
// IndexedDB via Dexie.js — "HaemiChatDB"
// Author: Haemi Infrastructure Team
// Standard: Google/Meta Grade TypeScript (Zero `any`)
// Policy: ZERO DATA DELETION — Soft-sync only
// ============================================================

import Dexie, { type Table } from 'dexie';
import { logger } from '@/utils/logger';
import type {
    Conversation,
    Message,
    Attachment,
    MessageReaction,
    ReplyPreview,
    ChatParticipant,
    UserId,
    MessageId,
    ConversationId
} from '@/types/chat.ts';

// ─── 1. PERSISTED ENTITY DEFINITIONS ─────────────────────────────────────────
//
// These interfaces mirror the frontend types from chat.ts but are declared
// separately so that IndexedDB schema decisions (like which fields to index)
// are kept inside this service layer. Structural compatibility is enforced
// through explicit mapping in the read/write helpers below.

export interface PersistedConversation {
    /** Primary Key — UUID */
    id: ConversationId;
    isDraft?: boolean;
    name?: string;
    updatedAt: string;
    lastMessageAt: string;
    lastMessage: string;
    lastMessageId: MessageId;
    /** Stored as JSON string because Dexie cannot index nested objects */
    participantsJson: string;
    participantsHash: string;
    unreadCount: number;
    messageCount: number;
    sequenceCounter: number;
    /** ISO timestamp of when this record was written to local DB */
    localSyncedAt: string;
}

export interface PersistedMessage {
    /** Primary Key — UUID */
    id: MessageId;
    conversationId: ConversationId;
    senderId: UserId;
    tempId?: string;
    content: string;
    messageType: 'text' | 'image' | 'document';
    /** Stored as JSON string */
    attachmentsJson: string;
    isRead: boolean;
    status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
    deliveredAt?: string;
    readAt?: string;
    createdAt: string;
    senderName?: string;
    isMe: boolean;
    /** Stored as JSON string */
    reactionsJson: string;
    /** Stored as JSON string */
    replyToJson?: string;
    replyToId?: MessageId;
    sequenceNumber?: number;
    /** ISO timestamp of when this was written locally */
    localSyncedAt: string;
}

export interface PersistedPresence {
    /** Primary Key — User UUID */
    userId: UserId;
    isOnline: boolean;
    last_activity: string;
    /** ISO timestamp */
    localSyncedAt: string;
}

// ─── 2. DATABASE CLASS ────────────────────────────────────────────────────────

class HaemiChatDatabase extends Dexie {
    conversations!: Table<PersistedConversation, ConversationId>;
    messages!: Table<PersistedMessage, MessageId>;
    presence!: Table<PersistedPresence, UserId>;
    pendingMessages!: Table<PersistedMessage, MessageId>;

    constructor() {
        super('HaemiChatDB');

        /**
         * Schema v1: Initial institutional schema.
         * Indices are chosen for the access patterns required by:
         *   - Conversation list (sorted by lastMessageAt DESC)
         *   - Message thread (sorted by createdAt ASC per conversation)
         *   - Delta sync (looking up messages by conversationId + createdAt)
         *   - Presence lookup (by userId)
         */
        this.version(1).stores({
            conversations: 'id, lastMessageAt, updatedAt, localSyncedAt',
            messages: 'id, [conversationId+createdAt], conversationId, createdAt, sequenceNumber, localSyncedAt',
            presence: 'userId, localSyncedAt',
        });

        /**
         * Schema v2: Institutional Outbox Addition (Phase 3)
         * - Added pendingMessages for offline outbox resilience.
         * - This ensures clinical data is never lost during transit.
         */
        this.version(2).stores({
            conversations: 'id, lastMessageAt, updatedAt, localSyncedAt',
            messages: 'id, conversationId, createdAt, localSyncedAt, tempId',
            presence: 'userId, isOnline, localSyncedAt',
            pendingMessages: 'id, conversationId, createdAt, tempId'
        });

        /**
         * Schema v3: Critical Index Restoration
         */
        this.version(3).stores({
            conversations: 'id, lastMessageAt, updatedAt, localSyncedAt',
            messages: 'id, [conversationId+createdAt], conversationId, createdAt, localSyncedAt, tempId',
            presence: 'userId, isOnline, localSyncedAt',
            pendingMessages: 'id, [conversationId+createdAt], conversationId, createdAt, tempId'
        });

        /**
         * Schema v4: Sequence-based Delta Sync Hardening (Meta-Grade)
         * - Added sequenceNumber index for gap detection.
         * - Added [conversationId+sequenceNumber] for efficient per-thread delta fetches.
         */
        this.version(4).stores({
            conversations: 'id, lastMessageAt, updatedAt, localSyncedAt',
            messages: 'id, [conversationId+createdAt], [conversationId+sequenceNumber], conversationId, createdAt, sequenceNumber, localSyncedAt, tempId',
            presence: 'userId, isOnline, localSyncedAt',
            pendingMessages: 'id, [conversationId+createdAt], conversationId, createdAt, tempId'
        });
    }
}

const db = new HaemiChatDatabase();

// ... existing mapping helpers ...
// (I will keep the rest of the mapping helpers and add new public methods below)

/**
 * Institutional Gap Detection: Retrieves the highest sequence number for a thread.
 */
async function getLastSequenceNumber(conversationId: ConversationId): Promise<number> {
    try {
        const last = await db.messages
            .where('[conversationId+sequenceNumber]')
            .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
            .last();
        return last?.sequenceNumber ?? 0;
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Index lookup failure';
        logger.error('[Storage] Failed to get last sequence number', msg);
        return 0;
    }
}

/**
 * Retrieves the global maximum sequence number across all threads.
 */
async function getGlobalMaxSequenceNumber(): Promise<number> {
    try {
        const last = await db.messages.orderBy('sequenceNumber').last();
        return last?.sequenceNumber ?? 0;
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Global index failure';
        logger.error('[Storage] Failed to get global max sequence', msg);
        return 0;
    }
}

// ─── 3. MAPPING HELPERS ───────────────────────────────────────────────────────

/**
 * Converts a frontend `Conversation` into the persisted DB format.
 * All nested arrays are serialized to JSON strings.
 */
function toPersistedConversation(c: Conversation): PersistedConversation {
    return {
        id: c.id as ConversationId,
        isDraft: c.isDraft,
        name: c.name,
        updatedAt: c.updatedAt,
        lastMessageAt: c.lastMessageAt,
        lastMessage: c.lastMessage ?? '',
        lastMessageId: c.lastMessageId ?? '',
        participantsJson: JSON.stringify(c.participants),
        participantsHash: c.participantsHash,
        unreadCount: c.unreadCount,
        messageCount: c.messageCount,
        sequenceCounter: c.sequenceCounter,
        localSyncedAt: new Date().toISOString(),
    };
}

/**
 * Converts a persisted DB record back into the frontend `Conversation` type.
 * JSON strings are safely parsed with a fallback to empty arrays.
 */
function fromPersistedConversation(p: PersistedConversation): Conversation {
    let participants: ChatParticipant[] = [];
    try {
        const parsed: unknown = JSON.parse(p.participantsJson);
        if (Array.isArray(parsed)) {
            participants = parsed as ChatParticipant[];
        }
    } catch (e: unknown) {
        logger.warn('[Storage] Failed to parse participants JSON', { id: p.id, error: e instanceof Error ? e.message : String(e) });
    }

    return {
        id: p.id,
        isDraft: p.isDraft,
        name: p.name,
        updatedAt: p.updatedAt,
        lastMessageAt: p.lastMessageAt,
        lastMessage: p.lastMessage,
        lastMessageId: p.lastMessageId,
        participants,
        participantsHash: p.participantsHash,
        unreadCount: p.unreadCount,
        messageCount: p.messageCount,
        sequenceCounter: p.sequenceCounter,
    };
}

/**
 * Converts a frontend `Message` into the persisted DB format.
 */
function toPersistedMessage(m: Message, isMe: boolean): PersistedMessage {
    return {
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        tempId: m.tempId,
        content: m.content,
        messageType: m.messageType,
        attachmentsJson: JSON.stringify(m.attachments ?? []),
        isRead: m.isRead ?? false,
        status: m.status,
        deliveredAt: m.deliveredAt,
        readAt: m.readAt,
        createdAt: m.createdAt,
        senderName: m.senderName,
        isMe,
        reactionsJson: JSON.stringify(m.reactions ?? []),
        replyToJson: m.replyTo ? JSON.stringify(m.replyTo) : undefined,
        replyToId: m.replyToId,
        sequenceNumber: m.sequenceNumber,
        localSyncedAt: new Date().toISOString(),
    };
}

/**
 * Converts a persisted DB record back into the frontend `Message` type.
 * All JSON fields are safely parsed with typed fallbacks.
 */
function fromPersistedMessage(p: PersistedMessage): Message {
    let attachments: Attachment[] = [];
    let reactions: MessageReaction[] = [];
    let replyTo: ReplyPreview | undefined;

    try {
        const parsed: unknown = JSON.parse(p.attachmentsJson);
        if (Array.isArray(parsed)) attachments = parsed as Attachment[];
    } catch (e: unknown) {
        logger.warn('[Storage] Failed to parse attachments JSON', { id: p.id, error: e instanceof Error ? e.message : String(e) });
    }

    try {
        const parsed: unknown = JSON.parse(p.reactionsJson);
        if (Array.isArray(parsed)) reactions = parsed as MessageReaction[];
    } catch (e: unknown) {
        logger.warn('[Storage] Failed to parse reactions JSON', { id: p.id, error: e instanceof Error ? e.message : String(e) });
    }

    if (p.replyToJson) {
        try {
            const parsed: unknown = JSON.parse(p.replyToJson);
            if (parsed && typeof parsed === 'object') {
                replyTo = parsed as ReplyPreview;
            }
        } catch (e: unknown) {
            logger.warn('[Storage] Failed to parse replyTo JSON', { id: p.id, error: e instanceof Error ? e.message : String(e) });
        }
    }

    return {
        id: p.id,
        conversationId: p.conversationId,
        senderId: p.senderId,
        tempId: p.tempId,
        content: p.content,
        messageType: p.messageType,
        attachments,
        isRead: p.isRead,
        status: p.status,
        deliveredAt: p.deliveredAt,
        readAt: p.readAt,
        createdAt: p.createdAt,
        senderName: p.senderName,
        isMe: p.isMe,
        reactions,
        replyTo,
        replyToId: p.replyToId,
        sequenceNumber: p.sequenceNumber,
    };
}

// ─── 4. PUBLIC API — CONVERSATIONS ────────────────────────────────────────────

/**
 * Persists multiple conversations in a single bulk operation.
 * Uses `bulkPut` so that existing records are updated (not duplicated).
 */
async function putConversations(conversations: Conversation[]): Promise<void> {
    try {
        const records = conversations.map(toPersistedConversation);
        await db.conversations.bulkPut(records);
        logger.info(`[Storage] ✓ Persisted ${records.length} conversations to IndexedDB`);
    } catch (e: unknown) {
        logger.error('[Storage] Failed to persist conversations', {
            error: e instanceof Error ? e.message : String(e),
            count: conversations.length,
        });
    }
}

/**
 * Retrieves all conversations from IndexedDB, sorted by lastMessageAt DESC.
 * Returns an empty array if the store is empty or if an error occurs.
 */
async function getAllConversations(): Promise<Conversation[]> {
    try {
        const records = await db.conversations
            .orderBy('lastMessageAt')
            .reverse()
            .toArray();
        return records.map(fromPersistedConversation);
    } catch (e: unknown) {
        logger.error('[Storage] Failed to retrieve conversations from IndexedDB', {
            error: e instanceof Error ? e.message : String(e),
        });
        return [];
    }
}

// ─── 5. PUBLIC API — MESSAGES ─────────────────────────────────────────────────

/**
 * The `isMe` flag must be passed separately as it is derived from the
 * authenticated user's ID, which the storage service does not own.
 */
async function putMessages(messages: Message[], currentUserId: UserId): Promise<void> {
    try {
        const records = messages.map(m => toPersistedMessage(m, m.senderId === currentUserId));
        await db.messages.bulkPut(records);
        logger.info(`[Storage] ✓ Persisted ${records.length} messages to IndexedDB`);
    } catch (e: unknown) {
        logger.error('[Storage] Failed to persist messages', {
            error: e instanceof Error ? e.message : String(e),
            count: messages.length,
        });
    }
}

/**
 * Retrieves all messages for a given conversation, sorted by createdAt ASC.
 * Returns an empty array if no messages are found or if an error occurs.
 */
async function getMessagesByConversation(conversationId: ConversationId): Promise<Message[]> {
    try {
        const records = await db.messages
            .where('[conversationId+createdAt]')
            .between(
                [conversationId, Dexie.minKey],
                [conversationId, Dexie.maxKey],
            )
            .toArray();
        return records.map(fromPersistedMessage);
    } catch (e: unknown) {
        logger.error('[Storage] Failed to retrieve messages from IndexedDB', {
            error: e instanceof Error ? e.message : String(e),
            conversationId,
        });
        return [];
    }
}

/**
 * Returns the ISO timestamp of the most recently received message for a
 * given conversation. Used as the `since` parameter for delta synchronization.
 * Returns `null` if no messages exist locally for this conversation.
 */
async function getLastSyncTimestamp(conversationId: ConversationId): Promise<string | null> {
    try {
        const last = await db.messages
            .where('[conversationId+createdAt]')
            .between(
                [conversationId, Dexie.minKey],
                [conversationId, Dexie.maxKey],
            )
            .last();
        return last?.createdAt ?? null;
    } catch (e: unknown) {
        logger.error('[Storage] Failed to get last sync timestamp', {
            error: e instanceof Error ? e.message : String(e),
            conversationId,
        });
        return null;
    }
}

/**
 * Institutional Hardening: Batched status updates to resolve sync fractures.
 */
async function markMessagesDelivered(messageIds: MessageId[]): Promise<void> {
    try {
        await db.messages.where('id').anyOf(messageIds).modify({ status: 'delivered' });
    } catch (e: unknown) {
        logger.error('[Storage] Failed to bulk update delivery status', { 
            error: e instanceof Error ? e.message : String(e), 
            count: messageIds.length 
        });
    }
}

async function markMessagesRead(messageIds: MessageId[], readAt: string): Promise<void> {
    try {
        await db.messages.where('id').anyOf(messageIds).modify({ 
            status: 'read', 
            readAt, 
            isRead: true 
        });
    } catch (e: unknown) {
        logger.error('[Storage] Failed to bulk update read status', { 
            error: e instanceof Error ? e.message : String(e), 
            count: messageIds.length 
        });
    }
}

// ─── 6. PUBLIC API — OUTBOX (OFFLINE RESILIENCE) ──────────────────────────────

/**
 * Persists a message to the pending outbox.
 * Occurs BEFORE many network attempts in a "Local-First" architecture.
 */
async function putPendingMessage(m: Message, currentUserId: UserId): Promise<void> {
    try {
        const record = toPersistedMessage(m, m.senderId === currentUserId);
        await db.pendingMessages.put(record);
        logger.info(`[Storage] 📥 Message ${m.id} queued in Outbox`);
    } catch (e: unknown) {
        logger.error('[Storage] Failed to queue message in Outbox', {
            error: e instanceof Error ? e.message : String(e),
            id: m.id
        });
    }
}

/**
 * Retrieves all pending messages from the outbox.
 */
async function getPendingMessages(): Promise<Message[]> {
    try {
        const records = await db.pendingMessages.toArray();
        return records.map(fromPersistedMessage);
    } catch (e: unknown) {
        logger.error('[Storage] Failed to retrieve Outbox messages', {
            error: e instanceof Error ? e.message : String(e)
        });
        return [];
    }
}

/**
 * Removes a message from the pending outbox.
 * Occurs after successful server acknowledgement.
 */
async function removePendingMessage(id: MessageId): Promise<void> {
    try {
        await db.pendingMessages.delete(id);
        logger.info(`[Storage] 📤 Message ${id} cleared from Outbox`);
    } catch (e: unknown) {
        logger.error('[Storage] Failed to clear message from Outbox', {
            error: e instanceof Error ? e.message : String(e),
            id
        });
    }
}

/**
 * Soft-updates the status of a pending message (e.g., 'sending' → 'failed').
 */
async function updatePendingMessageStatus(id: MessageId, status: 'sending' | 'failed'): Promise<void> {
    try {
        await db.pendingMessages.update(id, { status });
    } catch (e: unknown) {
        logger.error('[Storage] Failed to update pending message status', {
            error: e instanceof Error ? e.message : String(e),
            id
        });
    }
}

// ─── 7. PUBLIC API — PRESENCE ─────────────────────────────────────────────────

/**
 * Persists presence state for a set of users.
 */
async function putPresence(
    presenceMap: Record<string, { isOnline: boolean; last_activity: string }>,
): Promise<void> {
    try {
        const records: PersistedPresence[] = Object.entries(presenceMap).map(
            ([userId, state]) => ({
                userId: userId as UserId,
                isOnline: state.isOnline,
                last_activity: state.last_activity,
                localSyncedAt: new Date().toISOString(),
            }),
        );
        await db.presence.bulkPut(records);
    } catch (e: unknown) {
        logger.error('[Storage] Failed to persist presence data', {
            error: e instanceof Error ? e.message : String(e),
        });
    }
}

/**
 * Retrieves presence state for a specific user.
 * Returns `null` if not found.
 */
async function getPresence(userId: UserId): Promise<PersistedPresence | null> {
    try {
        return (await db.presence.get(userId)) ?? null;
    } catch (e: unknown) {
        logger.error('[Storage] Failed to retrieve presence for user', {
            error: e instanceof Error ? e.message : String(e),
            userId,
        });
        return null;
    }
}

// ─── 7. UTILITY ───────────────────────────────────────────────────────────────

/**
 * Completely wipes all local clinical data.
 * MUST ONLY be called on explicit user logout. Never called on simple errors.
 * Implements the "Zero Deletion" policy threshold — this is the only sanctioned
 * hard-delete operation in the client-side system.
 */
async function clearAll(): Promise<void> {
    try {
        await Promise.all([
            db.conversations.clear(),
            db.messages.clear(),
            db.presence.clear(),
            db.pendingMessages.clear(),
        ]);
        logger.info('[Storage] ✓ HaemiChatDB cleared on logout.');
    } catch (e: unknown) {
        logger.error('[Storage] Failed to clear HaemiChatDB on logout', {
            error: e instanceof Error ? e.message : String(e),
        });
    }
}

// ─── 8. EXPORTED SERVICE OBJECT ───────────────────────────────────────────────

export const storageService = {
    // Conversations
    putConversations,
    getAllConversations,
    // Messages
    putMessages,
    getMessagesByConversation,
    getLastSyncTimestamp,
    getLastSequenceNumber,
    getGlobalMaxSequenceNumber,
    markMessagesDelivered,
    markMessagesRead,
    // Presence
    putPresence,
    getPresence,
    // Outbox
    putPendingMessage,
    getPendingMessages,
    removePendingMessage,
    updatePendingMessageStatus,
    // Lifecycle
    clearAll,
} as const;
