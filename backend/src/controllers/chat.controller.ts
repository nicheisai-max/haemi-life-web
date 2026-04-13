// 🔒 HAEMI ATTACHMENT PIPELINE LOCK
// DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL
// SINGLE SOURCE: message_attachments ONLY
// FALLBACKS FORBIDDEN
// TYPESCRIPT STRICT MODE ENFORCED (GOOGLE/META GRADE)

import { Request, Response } from 'express';
import { pool } from '../config/db';
import { logger } from '../utils/logger';
import { socketIO as io } from '../app';
import { chatReliabilityService } from '../services/chat-reliability.service';
import * as path from 'path';
import { fileService } from '../services/file.service';
import { upload as commonUpload } from '../middleware/upload.middleware';
import { sendResponse, sendError } from '../utils/response';
import { notificationService } from '../services/notification.service';
import { mapMessageToResponse, mapConversationToResponse } from '../utils/chat.mapper';
import crypto from 'crypto';
import { statusService } from '../services/status.service';
import {
    DbMessage,
    DbConversation,
    ChatParticipant,
    DbAttachment,
    DbReaction,
    ConversationResponse,
    UserId,
    MessageId,
    ConversationId,
    SendMessageRequest,
    ReactToMessageRequest,
    DeleteMessageRequest
} from '../types/chat.types';
import { FileDomain } from '../types/file';
import { ChatMessage, MessageDeletedPayload } from '../types/socket.types';
import { JWTPayload } from '../types/express';

// 🔒 STRICT UUID VALIDATION (RFC 4122)
const isUUID = (id: string | undefined | null): id is string => {
    if (!id) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
};

// Legacy: redirecting the internal export to the common middleware for route compatibility
export const upload = commonUpload;

// Upload Attachment Endpoint
export const uploadAttachment = async (req: Request, res: Response) => {
    if (!req.file) {
        return sendError(res, 400, 'No file uploaded');
    }

    try {
        const { mimetype, buffer } = req.file;
        // Institutional Privacy Guard: Strip any absolute path segments leaked by client environments
        const originalname = path.basename(req.file.originalname);

        // Institutional Save: Non-blocking async write via FileService
        const relativePath = await fileService.saveFileFromBuffer(buffer, FileDomain.CHAT_TEMP, originalname);

        // P0 FIX: Storing BOTH relative path and originalName as metadata
        const stagingMetadata = `${relativePath}|${originalname}`;

        const result = await pool.query(
            'INSERT INTO temp_attachments (data, mime, name) VALUES (NULL, $1, $2) RETURNING id',
            [mimetype, stagingMetadata]
        );

        const tempId = result.rows[0].id;
        const virtualUrl = `/api/files/temp/${tempId}`;

        return sendResponse(res, 200, true, 'Attachment staged successfully', {
            url: virtualUrl,
            tempId: tempId,
            type: req.file.mimetype.startsWith('image/') ? 'image' : 'document',
            originalName: originalname
        });
    } catch (error: unknown) {
        logger.error('Error in uploadAttachment:', {
            error: error instanceof Error ? error.message : String(error),
            userId: req.user?.id
        });
        return sendError(res, 500, 'Error staging attachment');
    }
};

// Get all conversations for the current user (Phase 4: Batch Processed)
export const getConversations = async (req: Request, res: Response) => {
    const user = req.user as JWTPayload | undefined;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const userId = user.id as UserId;

    if (!isUUID(userId)) {
        return sendError(res, 400, 'Invalid or missing userId (UUID expected)');
    }

    try {
        const convResult = await pool.query<{
            id: string,
            updated_at: string | Date,
            last_message_at: string | Date | null,
            participants_hash: string,
            last_message_id: string | null
        }>(
            `SELECT DISTINCT ON (c.id) 
                c.id, c.updated_at, 
                COALESCE(m.created_at, c.last_message_at, c.updated_at) as last_message_at, 
                c.participants_hash, m.id as last_message_id
             FROM conversations c
             JOIN conversation_participants cp ON c.id = cp.conversation_id
             LEFT JOIN messages m ON c.id = m.conversation_id AND m.is_deleted = false
             WHERE cp.user_id = $1
               AND (
                     -- D7 REMEDIATION: Exclude ghost conversations (0 messages) older than
                     -- 10 minutes. Using EXISTS (not COUNT) for optimal query plan.
                     -- DB is the SSOT: the row still exists in "conversations"; we only
                     -- filter the read projection so the sidebar stays clean.
                     EXISTS (
                         SELECT 1 FROM messages msg
                         WHERE msg.conversation_id = c.id
                           AND msg.is_deleted = false
                     )
                     -- 10-minute grace: allows freshly-created threads to appear in the
                     -- sidebar immediately so the new-chat UX flow is not broken.
                     OR c.created_at > NOW() - INTERVAL '10 minutes'
                   )
             ORDER BY c.id, m.created_at DESC NULLS LAST`,
            // TS-STRICT: String() strips the branded UserId type → resolves to the
            // `pool.query(text, values)` Promise overload, preventing pg from matching
            // the callback overload `pool.query(text, values, callback)` instead.
            [String(userId)]
        );

        if (convResult.rows.length === 0) {
            return sendResponse(res, 200, true, 'No conversations found', []);
        }

        const sortedConvs = convResult.rows.sort((a, b): number => {
            const timeA = new Date(a.last_message_at ?? a.updated_at).getTime();
            const timeB = new Date(b.last_message_at ?? b.updated_at).getTime();
            return timeB - timeA;
        });

        const convIds: string[] = sortedConvs.map((c): string => c.id);

        const msgResult = await pool.query<{ conversation_id: string, preview_text: string | null }>(
            `SELECT DISTINCT ON (conversation_id) conversation_id, preview_text
             FROM messages
             WHERE conversation_id = ANY($1)
               AND is_deleted = false
               AND NOT EXISTS (SELECT 1 FROM deleted_messages dm WHERE dm.message_id = messages.id AND dm.user_id = $2)
             ORDER BY conversation_id, created_at DESC`,
            [convIds, userId]
        );
        const lastMsgMap = new Map<string, string | null>(msgResult.rows.map(r => [r.conversation_id, r.preview_text]));

        const unreadResult = await pool.query<{ conversation_id: string, count: string }>(
            `SELECT m.conversation_id, COUNT(*) as count
             FROM messages m
             WHERE m.conversation_id = ANY($1)
               AND m.is_deleted = false
               AND m.status != 'read' AND m.sender_id != $2
               AND NOT EXISTS (SELECT 1 FROM deleted_messages dm WHERE dm.message_id = m.id AND dm.user_id = $2)
             GROUP BY m.conversation_id`,
            [convIds, userId]
        );
        const unreadMap = new Map<string, number>(unreadResult.rows.map(r => [r.conversation_id, parseInt(r.count)]));

        const partResult = await pool.query<{
            conversation_id: string,
            id: string,
            name: string,
            role: string,
            initials: string,
            profile_image: string | null
        }>(
            `SELECT cp.conversation_id, u.id, u.name, u.role, u.initials, u.profile_image
             FROM conversation_participants cp
             JOIN users u ON cp.user_id = u.id
             WHERE cp.conversation_id = ANY($1) AND cp.user_id != $2`,
            [convIds, String(userId)]
        );

        const partMap = new Map<string, ChatParticipant[]>();
        partResult.rows.forEach((r): void => {
            if (!partMap.has(r.conversation_id)) partMap.set(r.conversation_id, []);
            partMap.get(r.conversation_id)!.push({
                id: r.id as UserId, 
                name: r.name || 'Unknown Professional', 
                role: r.role || 'user', 
                initials: r.initials || '??', 
                profileImage: r.profile_image
            });
        });

        const conversations: ConversationResponse[] = sortedConvs.map((row): ConversationResponse | null => {
            const dbConv: DbConversation = {
                id: row.id as ConversationId,
                updated_at: row.updated_at,
                last_message_at: row.last_message_at ?? row.updated_at,
                participants_hash: row.participants_hash,
                last_message: lastMsgMap.get(row.id) ?? undefined,
                last_message_id: (row.last_message_id as MessageId | null) ?? undefined,
                participants: partMap.get(row.id) ?? [],
                unread_count: unreadMap.get(row.id) ?? 0,
                message_count: 0,
                sequence_counter: 0
            };
            const mapped = mapConversationToResponse(dbConv);
            return mapped;
        }).filter((c): c is ConversationResponse => c !== null);

        return sendResponse(res, 200, true, 'Conversations fetched (Batch Mode)', conversations);
    } catch (error: unknown) {
        logger.error('[Phase 4] getConversations batch fetch failed:', {
            error: error instanceof Error ? error.message : String(error),
            userId
        });
        return sendError(res, 500, 'Server error during batch fetch');
    }
};

export const getMessages = async (req: Request, res: Response) => {
    const user = req.user as JWTPayload | undefined;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const userId = user.id as UserId;
    const { conversationId } = req.params as { conversationId: ConversationId };

    if (!isUUID(conversationId)) {
        return sendError(res, 400, 'Invalid or missing conversationId (UUID expected)');
    }
    if (!isUUID(userId)) {
        return sendError(res, 400, 'Invalid or missing userId (UUID expected)');
    }

    try {
        const [membershipCheck, result] = await Promise.all([
            pool.query(
                'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
                [conversationId, userId]
            ),
            pool.query<DbMessage>(
                `
                SELECT 
                    m.id, m.conversation_id, m.content, m.sender_id, m.created_at, 
                    m.message_type, m.status, m.delivered_at, m.read_at, m.reply_to_id,
                    u.name as sender_name, u.role as sender_role,
                    m.sequence_number
                FROM messages m
                LEFT JOIN users u ON m.sender_id = u.id
                WHERE m.conversation_id = $1
                  AND m.is_deleted = false
                  AND NOT EXISTS (
                      SELECT 1 FROM deleted_messages dm 
                      WHERE dm.message_id = m.id AND dm.user_id = $2
                  )
                ORDER BY m.created_at ASC
                `,
                [conversationId, userId]
            )
        ]);

        if (membershipCheck.rows.length === 0) {
            return sendError(res, 403, 'Not authorized to view this conversation');
        }

        if (result.rows.length === 0) {
            return sendResponse(res, 200, true, 'Messages fetched', []);
        }

        const messageIds = result.rows.map(m => m.id as MessageId);
        const replyToIds = result.rows.map(m => m.reply_to_id as MessageId).filter((id): id is MessageId => !!id);

        const [attachmentsRes, reactionsRes, repliesRes] = await Promise.all([
            pool.query<DbAttachment>(
                `SELECT id, message_id, file_path, file_type, file_size, file_name, file_extension, file_category, created_at
                 FROM message_attachments WHERE message_id = ANY($1)`,
                [messageIds]
            ),
            pool.query<DbReaction>(
                `SELECT message_id, reaction_type, user_id 
                 FROM message_reactions WHERE message_id = ANY($1)`,
                [messageIds]
            ),
            replyToIds.length > 0 ?
                pool.query<{ id: string, content: string, sender_name: string }>(
                    `SELECT m.id, m.content, u.name as sender_name
                     FROM messages m LEFT JOIN users u ON m.sender_id = u.id
                     WHERE m.id = ANY($1)`,
                    [replyToIds]
                ) :
                Promise.resolve({ rows: [] })
        ]);

        const attachmentsMap: Record<MessageId, DbAttachment[]> = attachmentsRes.rows.reduce((acc: Record<MessageId, DbAttachment[]>, att) => {
            if (!acc[att.message_id]) acc[att.message_id] = [];
            acc[att.message_id].push(att);
            return acc;
        }, {} as Record<MessageId, DbAttachment[]>);

        const reactionsMap: Record<MessageId, DbReaction[]> = reactionsRes.rows.reduce((acc: Record<MessageId, DbReaction[]>, rx) => {
            if (!acc[rx.message_id]) acc[rx.message_id] = [];
            acc[rx.message_id].push(rx);
            return acc;
        }, {} as Record<MessageId, DbReaction[]>);

        const repliesMap: Record<MessageId, { id: MessageId, content: string, sender_name: string }> = repliesRes.rows.reduce((acc: Record<MessageId, { id: MessageId, content: string, sender_name: string }>, row) => {
            acc[row.id as MessageId] = {
                id: row.id as MessageId,
                content: row.content,
                sender_name: row.sender_name
            };
            return acc;
        }, {} as Record<MessageId, { id: MessageId, content: string, sender_name: string }>);

        const messages: ChatMessage[] = result.rows.map(row => {
            const dbMsg: DbMessage = {
                ...row,
                attachments: attachmentsMap[row.id] || [],
                reactions: reactionsMap[row.id] || [],
                reply_to: row.reply_to_id ? (repliesMap[row.reply_to_id] as { id: MessageId, content: string, sender_name: string }) : undefined
            };
            const normalized = mapMessageToResponse(dbMsg);
            return normalized;
        }).filter((m): m is ChatMessage => m !== null);

        return sendResponse(res, 200, true, 'Messages fetched', messages);
    } catch (error: unknown) {
        logger.error('[ChatController] Error fetching messages:', {
            error: error instanceof Error ? error.message : String(error),
            conversationId,
            userId
        });
        return sendError(res, 500, 'Server error fetching messages');
    }
};

export const sendMessage = async (req: Request, res: Response) => {
    const user = req.user as JWTPayload | undefined;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const senderId = user.id as UserId;
    const { participantId, content, messageType = 'text', attachment, tempId, attachments } = req.body as SendMessageRequest;
    let { conversationId } = req.body as SendMessageRequest;

    if (!isUUID(senderId)) {
        return sendError(res, 400, 'Invalid or missing senderId (UUID expected)');
    }

    // P0: Institutional Hub Routing - Allow Atomic Creation via participantId
    if (!conversationId && participantId) {
        if (!isUUID(participantId)) {
            return sendError(res, 400, 'Invalid participantId (UUID expected)');
        }
        if (participantId.toLowerCase() === senderId.toLowerCase()) {
            return sendError(res, 400, 'Self-messaging is currently not permitted');
        }
    } else if (!isUUID(conversationId)) {
        return sendError(res, 400, 'Invalid or missing conversationId (UUID expected)');
    }

    // P0 HARDENING: Institutional Mult-File Constraint (Max 5)
    // We check both legacy 'attachment' and modern 'attachments' array
    const attachmentPool = Array.isArray(attachments) ? attachments : (attachment ? [attachment] : []);
    if (attachmentPool.length > 5) {
        return sendError(res, 400, 'Institutional Limit Exceeded: Maximum 5 attachments per message permitted');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // P0: Atomic Conversation Upsert (Phase 1)
        if (!conversationId && participantId) {
            const sortedIds = [senderId.toLowerCase(), participantId.toLowerCase()].sort();
            const hashBase = sortedIds.join(':');
            const participantsHash = crypto.createHash('sha256').update(hashBase).digest('hex');

            const insertResult = await client.query(
                `INSERT INTO conversations (participants_hash, last_message_at) 
                 VALUES ($1, NOW()) 
                 ON CONFLICT (participants_hash) DO NOTHING 
                 RETURNING id`,
                [participantsHash]
            );

            if (insertResult.rows.length > 0) {
                conversationId = insertResult.rows[0].id as ConversationId;
                // Atomic participant linking
                await client.query(
                    `INSERT INTO conversation_participants (conversation_id, user_id) 
                     SELECT $1, u.id FROM users u WHERE u.id IN ($2, $3)
                     ON CONFLICT DO NOTHING`,
                    [conversationId, senderId, participantId]
                );
                logger.info('[ChatController] New atomic conversation created via sendMessage', { conversationId, participants: [senderId, participantId] });
            } else {
                const existing = await client.query(
                    'SELECT id FROM conversations WHERE participants_hash = $1',
                    [participantsHash]
                );
                if (existing.rows.length === 0) {
                    throw new Error('Consistency fracture: Hash exists but conversation not found during atomic send');
                }
                conversationId = existing.rows[0].id as ConversationId;
            }
        } else {
            // SECURITY GUARD: Institutional verification that sender is a participant
            const membershipCheck = await client.query(
                'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
                [conversationId, senderId]
            );

            if (membershipCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return sendError(res, 403, 'Not authorized to send to this conversation');
            }
        }

        if (!conversationId) {
            throw new Error('Consistency fracture: conversationId is null after upsert/check');
        }

        // Institutional Hardening: Backend serves as encrypted pass-through (Zero-Knowledge)
        const storedContent = content;

        // P0 FIX: Institutional Preview Guard
        // Ensure preview_text is NEVER empty if attachments exist
        let decodedPreview = content && content.startsWith('enc:') ? '[Encrypted Preview]' : content;
        if (!decodedPreview && attachmentPool.length > 0) {
            decodedPreview = '📎 Attachment';
        }

        const sequenceNumber = await chatReliabilityService.getNextSequence(conversationId as string);

        const msgResult = await client.query<DbMessage>(
            `
            INSERT INTO messages (conversation_id, sender_id, sender_role, content, preview_text, message_type, reply_to_id, status, sequence_number)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent', $8)
            RETURNING *
            `,
            [conversationId as string, senderId, user.role, storedContent as string, (decodedPreview || '') as string, messageType as string, req.body.replyToId as MessageId, sequenceNumber]
        );

        const newMessage = msgResult.rows[0];


        if (req.body.replyToId) {
            const replyResult = await client.query(
                `
                SELECT rm.id, rm.content, ru.name as sender_name
                FROM messages rm
                LEFT JOIN users ru ON rm.sender_id = ru.id
                WHERE rm.id = $1
                `,
                [req.body.replyToId]
            );
            if (replyResult.rows.length > 0) {
                const replyTo = replyResult.rows[0];
                newMessage.reply_to = {
                    ...replyTo,
                    content: replyTo.content
                };
            }
        }

        const finalAttachments: { id?: string; url: string; type: string; size: number; name: string; filePath?: string }[] = [];

        // Process all attachments in the pool (Google/Meta Grade Multi-File)
        for (const att of attachmentPool) {
            if (att.url && att.url.includes('/files/temp/')) {
                const innerTempId = att.url.split('/').pop();

                // Institutional Move: Atomic staging-to-vault promotion via FileService
                const metadata = await fileService.moveStagedFile(innerTempId as string, FileDomain.CHAT);

                if (!metadata) {
                    logger.warn('[ChatController] Staged attachment promotion failed (Physical file missing)', {
                        tempId: innerTempId,
                        messageId: newMessage.id,
                        senderId
                    });
                    // Institutional Cleanup: Purge dead temp record to prevent infinite sync loops
                    await client.query('DELETE FROM temp_attachments WHERE id = $1', [innerTempId]);
                    continue;
                }

                let fileCat = 'other';
                if (metadata.mimeType.startsWith('image/')) fileCat = 'image';
                else if (metadata.mimeType.startsWith('application/') || metadata.mimeType.startsWith('text/')) fileCat = 'document';

                const attResult = await client.query(
                    `INSERT INTO message_attachments (message_id, file_path, file_type, file_name, file_size, file_extension, file_category) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                    [newMessage.id, metadata.filePath, metadata.mimeType, metadata.fileName, metadata.fileSize, path.extname(metadata.fileName), fileCat]
                );

                finalAttachments.push({
                    id: attResult.rows[0].id, // P0 FIX: Store actual DB ID
                    url: `/api/files/message/${attResult.rows[0].id}`,
                    type: metadata.mimeType || 'document',
                    size: metadata.fileSize,
                    name: metadata.fileName,
                    filePath: metadata.filePath // Keep physical path for internal use
                });

                // Cleanup temp record after successful physical move
                await client.query('DELETE FROM temp_attachments WHERE id = $1', [innerTempId]);
            }
        }

        newMessage.reactions = [];

        // P0 FIX: Institutional Attachment Normalization for Socket Payload
        const normalizedAttachments: DbAttachment[] = finalAttachments.map(fa => ({
            id: fa.id || crypto.randomUUID(), // Use actual DB ID
            message_id: newMessage.id,
            file_path: fa.filePath || fa.url,
            file_type: fa.type,
            file_size: fa.size,
            file_name: fa.name,
            file_extension: path.extname(fa.name),
            file_category: fa.type.startsWith('image/') ? 'image' : 'document',
            created_at: new Date()
        }));

        newMessage.attachments = normalizedAttachments;

        await client.query(
            'UPDATE conversations SET last_message_id = $1, preview_text = $2, last_message_at = NOW(), updated_at = NOW() WHERE id = $3',
            [newMessage.id, (decodedPreview || '') as string, conversationId as string]
        );

        await client.query('COMMIT');

        const senderName = user.name || 'Someone';
        const socketPayload = mapMessageToResponse({
            ...newMessage,
            sender_name: senderName,
            sender_role: user.role,
            attachments: normalizedAttachments
        });

        if (socketPayload && tempId) {
            socketPayload.tempId = tempId;
        }

        if (io && socketPayload) {
            io.to(`conversation:${conversationId}`).emit('messageReceived', socketPayload);

            // The Governor Mirroring
            io.to('admin:observability').emit('adminMirrorEvent', {
                event: 'messageReceived',
                data: socketPayload,
                timestamp: new Date().toISOString()
            });
        }

        chatReliabilityService.getParticipants(conversationId as string).then(participants => {
            const others = participants.filter(pid => pid !== senderId);
            let previewText = finalAttachments.length > 0 ? '📎 Attachment' : 'New message';
            if (content) {
                const previewStr = (decodedPreview || '') as string;
                previewText = (previewStr.length > 100) ? previewStr.substring(0, 100) + '...' : previewStr;
            }

            others.forEach(pid => {
                notificationService.create(pid as UserId, `New message from ${senderName}`, previewText, 'info')
                    .catch(e => logger.error('Notification failed:', e));
            });
        }).catch(e => logger.error('Participant lookup failed:', e));

        return sendResponse(res, 201, true, 'Message sent', socketPayload);
    } catch (error: unknown) {
        if (client) await client.query('ROLLBACK');
        logger.error('[Phase 5] sendMessage error:', {
            error: error instanceof Error ? error.message : String(error),
            conversationId,
            senderId
        });
        return sendError(res, 500, 'Server error sending message');
    } finally {
        if (client) client.release();
    }
};

export const startConversation = async (req: Request, res: Response) => {
    const user = req.user as JWTPayload | undefined;
    if (!user || !user.id) return sendError(res, 401, 'Unauthorized');
    const userId = user.id as UserId;
    const { participantId } = req.body as { participantId: UserId };

    // Forensic Validation: Ensure participantId is a valid UUID and not self
    if (!participantId) {
        logger.warn('[ChatController] startConversation: Missing participantId', { userId });
        return sendError(res, 400, 'Participant ID required');
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(participantId)) {
        logger.error('[ChatController] startConversation: Invalid UUID format', { userId, participantId });
        return sendError(res, 400, 'Invalid Participant ID (UUID expected)');
    }

    if (participantId.toLowerCase() === userId.toLowerCase()) {
        logger.warn('[ChatController] startConversation: Attempted self-messaging', { userId });
        return sendError(res, 400, 'Self-messaging is currently not permitted');
    }

    try {
        // Deterministic Hash Generation (Institutional Grade)
        const sortedIds = [userId.toLowerCase(), participantId.toLowerCase()].sort();
        const hashBase = sortedIds.join(':');
        const participantsHash = crypto.createHash('sha256').update(hashBase).digest('hex');

        // ON CONFLICT requires the UNIQUE constraint added in init.sql v4.0
        const insertResult = await pool.query(
            `INSERT INTO conversations (participants_hash, last_message_at) 
             VALUES ($1, NOW()) 
             ON CONFLICT (participants_hash) DO NOTHING 
             RETURNING id`,
            [participantsHash]
        );

        let conversationId: string;

        if (insertResult.rows.length > 0) {
            conversationId = insertResult.rows[0].id as ConversationId;
            // Atomic participant linking
            await pool.query(
                `INSERT INTO conversation_participants (conversation_id, user_id) 
                 SELECT $1, u.id FROM users u WHERE u.id IN ($2, $3)
                 ON CONFLICT DO NOTHING`,
                [conversationId, userId, participantId]
            );
            logger.info('[ChatController] New conversation created', { conversationId, participants: [userId, participantId] });
        } else {
            const existing = await pool.query(
                'SELECT id FROM conversations WHERE participants_hash = $1',
                [participantsHash]
            );
            if (existing.rows.length === 0) {
                throw new Error('Consistency fracture: Hash exists but conversation not found');
            }
            conversationId = existing.rows[0].id as ConversationId;
        }

        // D8 OPTIMIZATION: Return full conversation DTO instead of just ID
        const convResult = await pool.query<{
            id: string,
            updated_at: string | Date,
            last_message_at: string | Date | null,
            participants_hash: string,
            last_message_id: string | null
        }>(
            `SELECT c.id, c.updated_at, 
                COALESCE(m.created_at, c.last_message_at, c.updated_at) as last_message_at, 
                c.participants_hash, c.last_message_id
             FROM conversations c
             LEFT JOIN messages m ON c.last_message_id = m.id AND m.is_deleted = false
             WHERE c.id = $1`,
            [conversationId]
        );

        if (convResult.rows.length === 0) {
            throw new Error('Failed to retrieve newly established conversation');
        }

        const row = convResult.rows[0];

        // Fetch participants
        const partResult = await pool.query<{
            id: string,
            name: string,
            role: string,
            initials: string,
            profile_image: string | null
        }>(
            `SELECT u.id, u.name, u.role, u.initials, u.profile_image
             FROM conversation_participants cp
             JOIN users u ON cp.user_id = u.id
             WHERE cp.conversation_id = $1 AND cp.user_id != $2`,
            [conversationId, userId]
        );

        // Fetch last message preview separately (consistent with getConversations logic)
        const lastMsgResult = await pool.query<{ preview_text: string | null }>(
            `SELECT preview_text FROM messages 
             WHERE conversation_id = $1 AND is_deleted = false 
             ORDER BY created_at DESC LIMIT 1`,
            [conversationId]
        );

        const dbConv: DbConversation = {
            id: row.id as ConversationId,
            updated_at: row.updated_at,
            last_message_at: row.last_message_at ?? row.updated_at,
            participants_hash: row.participants_hash,
            last_message: lastMsgResult.rows[0]?.preview_text ?? undefined,
            last_message_id: (row.last_message_id as MessageId | null) ?? undefined,
            participants: partResult.rows.map(r => ({
                id: r.id as UserId, name: r.name, role: r.role, initials: r.initials, profileImage: r.profile_image
            })),
            unread_count: 0, // Freshly created or retrieved thread from user's perspective
            message_count: 0,
            sequence_counter: 0
        };

        const response = mapConversationToResponse(dbConv);
        if (!response) {
            throw new Error('Failed to map established conversation to response');
        }
        return sendResponse(res, 201, true, 'Conversation established', response);

    } catch (error: unknown) {
        logger.error('[ChatController] startConversation forensic failure:', {
            error: error instanceof Error ? error.message : String(error),
            userId,
            participantId
        });
        return sendError(res, 500, 'Institutional server error during conversation establishment');
    }
};

export const markAsDelivered = async (req: Request, res: Response) => {
    const user = req.user as JWTPayload | undefined;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const userId = user.id as UserId;
    const { conversationId } = req.params as { conversationId: ConversationId };

    try {
        const result = await pool.query<{ id: MessageId }>(
            `
            UPDATE messages 
            SET status = 'delivered', delivered_at = NOW() 
            WHERE conversation_id = $1 AND sender_id != $2 AND status = 'sent'
            RETURNING id
            `,
            [conversationId, userId]
        );
        if (io && result.rows.length > 0) {
            const messageIds = result.rows.map(r => r.id);
            io.to(`conversation:${conversationId}`).emit('messageDelivered', {
                conversationId: conversationId as ConversationId,
                messageIds: messageIds,
                userId: userId,
                timestamp: new Date().toISOString()
            });
        }
        return sendResponse(res, 200, true, 'Messages marked as delivered');
    } catch (error: unknown) {
        logger.error('Error marking delivered:', {
            error: error instanceof Error ? error.message : String(error),
            conversationId,
            userId
        });
        return sendError(res, 500, 'Server error');
    }
};

export const markAsRead = async (req: Request, res: Response) => {
    const user = req.user as JWTPayload | undefined;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const userId = user.id as UserId;
    const { conversationId } = req.params as { conversationId: ConversationId };

    try {
        const result = await pool.query<{ id: MessageId }>(
            `
            UPDATE messages 
            SET status = 'read', read_at = NOW(), is_read = true
            WHERE conversation_id = $1 AND sender_id != $2 AND status != 'read'
            RETURNING id
            `,
            [conversationId, userId]
        );
        if (io && result.rows.length > 0) {
            const messageIds = result.rows.map(r => r.id as MessageId);
            io.to(`conversation:${conversationId}`).emit('messageRead', {
                conversationId,
                messageIds,
                userId: userId
            });
        }
        return sendResponse(res, 200, true, 'Messages marked as read');
    } catch (error: unknown) {
        logger.error('Error marking read:', {
            error: error instanceof Error ? error.message : String(error),
            conversationId,
            userId
        });
        return sendError(res, 500, 'Server error');
    }
};

export const reactToMessage = async (req: Request, res: Response) => {
    const user = req.user as JWTPayload | undefined;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const userId = user.id as UserId;
    const { messageId } = req.params as { messageId: MessageId };
    const { reactionType } = req.body as ReactToMessageRequest;

    if (!reactionType || typeof reactionType !== 'string') {
        return sendError(res, 400, 'Invalid reaction type');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Authorization & Existence Check (Internal to Transaction)
        const msgResult = await client.query<{ conversation_id: string }>(
            `SELECT m.conversation_id FROM messages m 
             JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id 
             WHERE m.id = $1 AND cp.user_id = $2`,
            [messageId, userId]
        );

        if (msgResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return sendError(res, 403, 'Not authorized or message not found');
        }

        const conversationId = msgResult.rows[0].conversation_id;

        // 2. Deterministic Toggle Logic
        const existing = await client.query(
            'SELECT 1 FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND reaction_type = $3',
            [messageId, userId, reactionType]
        );

        let action: 'added' | 'removed';

        if (existing.rows.length > 0) {
            // Already reacted with the SAME type -> Remove it (Toggle off)
            await client.query(
                'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND reaction_type = $3',
                [messageId, userId, reactionType]
            );
            action = 'removed';
        } else {
            // New reaction or DIFFERENT type -> Purge others then set new (Single reaction policy)
            await client.query('DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2', [messageId, userId]);
            await client.query(
                'INSERT INTO message_reactions (message_id, user_id, reaction_type) VALUES ($1, $2, $3)',
                [messageId, userId, reactionType]
            );
            action = 'added';
        }

        await client.query('COMMIT');

        // 3. Institutional Emission after Success
        if (io) {
            const reactionData = { messageId, userId, reactionType, action };
            io.to(`conversation:${conversationId}`).emit('messageReaction', reactionData);

            // The Governor Mirroring
            io.to('admin:observability').emit('adminMirrorEvent', {
                event: 'messageReaction',
                data: reactionData,
                timestamp: new Date().toISOString()
            });
        }

        return sendResponse(res, 200, true, 'Reaction updated successfully');
    } catch (error: unknown) {
        await client.query('ROLLBACK');
        logger.error('[ChatController] Atomic reaction update failed:', {
            error: error instanceof Error ? error.message : String(error),
            messageId, userId, reactionType
        });
        return sendError(res, 500, 'Internal server error during reaction update');
    } finally {
        client.release();
    }
};

export const deleteMessage = async (req: Request, res: Response) => {
    const user = req.user as JWTPayload | undefined;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const userId = user.id as UserId;
    const { messageId } = req.params as { messageId: MessageId };
    const { forEveryone } = req.body as DeleteMessageRequest;

    try {
        const msgCheck = await pool.query<DbMessage>(
            `SELECT m.* FROM messages m 
             JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id 
             WHERE m.id = $1 AND cp.user_id = $2`,
            [messageId, userId]
        );

        if (msgCheck.rows.length === 0) {
            return sendError(res, 403, 'Not authorized or message not found');
        }

        const message = msgCheck.rows[0];
        const conversationId = message.conversation_id;

        let newLastMessageData: { id: MessageId, content: string, createdAt: string } | null = null;

        if (forEveryone) {
            if (message.sender_id !== userId) {
                return sendError(res, 403, 'Only sender can delete for everyone');
            }

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const attachments = await client.query<DbAttachment>(
                    'SELECT file_path FROM message_attachments WHERE message_id = $1 AND deleted_at IS NULL',
                    [messageId]
                );

                const deleteTime = new Date().toISOString();

                await client.query(
                    'UPDATE message_attachments SET deleted_at = $1 WHERE message_id = $2',
                    [deleteTime, messageId]
                );

                await client.query(
                    'UPDATE messages SET is_deleted = true, deleted_at = $1 WHERE id = $2',
                    [deleteTime, messageId]
                );

                // Sidebard Drift Fix (D1): Recalculate if this was the last message
                const convCheck = await client.query<{ last_message_id: string }>(
                    'SELECT last_message_id FROM conversations WHERE id = $1',
                    [conversationId]
                );

                if (convCheck.rows[0]?.last_message_id === messageId) {
                    const fallbackRes = await client.query<{ id: MessageId, preview_text: string, created_at: Date }>(
                        `SELECT id, COALESCE(preview_text, content) as preview_text, created_at FROM messages 
                         WHERE conversation_id = $1 AND is_deleted = false 
                         ORDER BY created_at DESC LIMIT 1`,
                        [conversationId]
                    );

                    if (fallbackRes.rows.length > 0) {
                        const fallback = fallbackRes.rows[0];
                        await client.query(
                            'UPDATE conversations SET last_message_id = $1, preview_text = $2, last_message_at = $3 WHERE id = $4',
                            [fallback.id, fallback.preview_text, fallback.created_at, conversationId]
                        );
                        newLastMessageData = {
                            id: fallback.id,
                            content: fallback.preview_text,
                            createdAt: fallback.created_at.toISOString()
                        };
                    } else {
                        // Empty thread now
                        await client.query(
                            'UPDATE conversations SET last_message_id = NULL, preview_text = NULL WHERE id = $1',
                            [conversationId]
                        );
                    }
                }

                await client.query('COMMIT');

                for (const att of attachments.rows) {
                    if (att.file_path) {
                        fileService.quarantineFile(att.file_path).catch(e =>
                            logger.error('[Forensic-Cleanup] File quarantine failed after soft-delete:', {
                                path: att.file_path,
                                error: e.message
                            })
                        );
                    }
                }

                if (io) {
                    const deleteData: MessageDeletedPayload = {
                        messageId,
                        conversationId: conversationId as ConversationId,
                        newLastMessage: newLastMessageData
                    };
                    io.to(`conversation:${conversationId}`).emit('messageDeleted', deleteData);
                    io.to('admin:observability').emit('adminMirrorEvent', {
                        event: 'messageDeleted',
                        data: deleteData,
                        timestamp: new Date().toISOString()
                    });
                }

                notificationService.recall(messageId).catch(e =>
                    logger.error('[Recall-Failure] Automated notification recall failed:', { messageId, error: e.message })
                );

            } catch (err: unknown) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }

        } else {
            // P0 INSTITUTIONAL FIX: Private Sync for Multi-tab "Delete for Me"
            await pool.query(
                `INSERT INTO deleted_messages (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [messageId, userId]
            );

            // Fetch New Last Message for THIS user to fix drift in their sidebar across all their tabs
            const localFallbackRes = await pool.query<{ id: MessageId, preview_text: string, created_at: Date }>(
                `SELECT m.id, COALESCE(m.preview_text, m.content) as preview_text, m.created_at 
                 FROM messages m 
                 WHERE m.conversation_id = $1 
                   AND m.is_deleted = false 
                   AND m.id NOT IN (SELECT message_id FROM deleted_messages WHERE user_id = $2)
                 ORDER BY m.created_at DESC 
                 LIMIT 1`,
                [conversationId, userId]
            );

            if (localFallbackRes.rows.length > 0) {
                const fb = localFallbackRes.rows[0];
                newLastMessageData = {
                    id: fb.id,
                    content: fb.preview_text,
                    createdAt: fb.created_at.toISOString()
                };
            }

            if (io) {
                const localDeleteData: MessageDeletedPayload = {
                    messageId,
                    conversationId: conversationId as ConversationId,
                    newLastMessage: newLastMessageData
                };
                io.to(`user:${userId}`).emit('localMessageDeleted', localDeleteData);
                io.to('admin:observability').emit('adminMirrorEvent', {
                    event: 'localMessageDeleted',
                    data: { ...localDeleteData, userId },
                    timestamp: new Date().toISOString()
                });
            }
        }
        return sendResponse(res, 200, true, 'Message deleted');
    } catch (error: unknown) {
        logger.error('[ChatController] Error deleting message:', {
            error: error instanceof Error ? error.message : String(error),
            messageId, userId
        });
        return sendError(res, 500, 'Server error during deletion');
    }
};

export const getPresence = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return sendError(res, 401, 'Unauthorized');

    const { userIds } = req.query;
    if (!userIds || typeof userIds !== 'string') {
        return sendError(res, 400, 'User IDs required as comma-separated string');
    }

    try {
        const ids = userIds.split(',').filter(id => id.length > 0);
        const presence = await statusService.getPresenceBatch(ids);
        return sendResponse(res, 200, true, 'Presence fetched', presence);
    } catch (error: unknown) {
        logger.error('Error fetching presence:', {
            error: error instanceof Error ? error.message : String(error),
            userIds
        });
        return sendError(res, 500, 'Server error');
    }
};

export const syncChat = async (req: Request, res: Response) => {
    const user = req.user as JWTPayload | undefined;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    const since = req.query.since as string;

    try {
        if (!since) return sendError(res, 400, 'Since timestamp required');

        const syncQuery = `
            SELECT m.*, 
                   u.name as sender_name, u.role as sender_role,
                   rm.content as reply_content, rm.sender_id as reply_sender_id
            FROM messages m
            JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
            LEFT JOIN users u ON m.sender_id = u.id
            LEFT JOIN messages rm ON m.reply_to_id = rm.id
            WHERE cp.user_id = $1 
              AND m.is_deleted = false
              AND m.created_at > $2
            ORDER BY m.created_at ASC
        `;

        const result = await pool.query<DbMessage>(syncQuery, [user.id, since]);
        const formatted = result.rows.map(row => mapMessageToResponse(row)).filter(m => m !== null);
        return sendResponse(res, 200, true, 'Chat synced', formatted);
    } catch (error: unknown) {
        logger.error('[ChatController] Error syncing chat:', {
            error: error instanceof Error ? error.message : String(error),
            userId: user.id,
            since
        });
        return sendError(res, 500, 'Server error during chat sync');
    }
};
