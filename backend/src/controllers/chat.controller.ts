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
import { encrypt, decrypt } from '../utils/security';
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
    ConversationResponse 
} from '../types/chat.types';
import { ChatMessage } from '../types/socket.types';
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
        const { originalname, mimetype, buffer } = req.file;
        
        // Institutional Save: Non-blocking async write via FileService
        const relativePath = await fileService.saveFileFromBuffer(buffer, 'chat/temp', originalname);

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
    const userId = user.id;

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
             LEFT JOIN messages m ON c.id = m.conversation_id
             WHERE cp.user_id = $1
             ORDER BY c.id, m.created_at DESC NULLS LAST`,
            [userId]
        );

        if (convResult.rows.length === 0) {
            return sendResponse(res, 200, true, 'No conversations found', []);
        }

        const sortedConvs = convResult.rows.sort((a, b) => {
            const timeA = new Date(a.last_message_at || a.updated_at).getTime();
            const timeB = new Date(b.last_message_at || b.updated_at).getTime();
            return timeB - timeA;
        });

        const convIds = sortedConvs.map(c => c.id);

        const msgResult = await pool.query<{ conversation_id: string, preview_text: string | null }>(
            `SELECT DISTINCT ON (conversation_id) conversation_id, preview_text
             FROM messages
             WHERE conversation_id = ANY($1)
               AND NOT EXISTS (SELECT 1 FROM deleted_messages dm WHERE dm.message_id = messages.id AND dm.user_id = $2)
             ORDER BY conversation_id, created_at DESC`,
            [convIds, userId]
        );
        const lastMsgMap = new Map<string, string | null>(msgResult.rows.map(r => [r.conversation_id, r.preview_text]));

        const unreadResult = await pool.query<{ conversation_id: string, count: string }>(
            `SELECT m.conversation_id, COUNT(*) as count
             FROM messages m
             WHERE m.conversation_id = ANY($1)
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
            [convIds, userId]
        );

        const partMap = new Map<string, ChatParticipant[]>();
        partResult.rows.forEach(r => {
            if (!partMap.has(r.conversation_id)) partMap.set(r.conversation_id, []);
            partMap.get(r.conversation_id)!.push({
                id: r.id, name: r.name, role: r.role, initials: r.initials, profileImage: r.profile_image
            });
        });

        const conversations: ConversationResponse[] = sortedConvs.map(row => {
            const dbConv: DbConversation = {
                id: row.id,
                updated_at: row.updated_at,
                last_message_at: row.last_message_at || row.updated_at,
                participants_hash: row.participants_hash,
                last_message: lastMsgMap.get(row.id) || undefined,
                last_message_id: row.last_message_id || undefined,
                participants: partMap.get(row.id) || [],
                unread_count: unreadMap.get(row.id) || 0,
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
    const userId = user.id;
    const { conversationId } = req.params as { conversationId: string };

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

        const messageIds = result.rows.map(m => m.id);
        const replyToIds = result.rows.map(m => m.reply_to_id).filter((id): id is string => !!id);

        const [attachmentsRes, reactionsRes, repliesRes] = await Promise.all([
            pool.query<DbAttachment>(
                `SELECT id, message_id, file_path, file_type, file_size, file_name, file_extension, file_category, created_at
                 FROM message_attachments WHERE message_id = ANY($1)`,
                [messageIds]
            ),
            pool.query<DbReaction>(
                `SELECT message_id, reaction_type as reaction_type, user_id as "userId" 
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

        const attachmentsMap: Record<string, DbAttachment[]> = attachmentsRes.rows.reduce((acc: Record<string, DbAttachment[]>, att) => {
            if (!acc[att.message_id]) acc[att.message_id] = [];
            acc[att.message_id].push(att);
            return acc;
        }, {});

        const reactionsMap: Record<string, DbReaction[]> = reactionsRes.rows.reduce((acc: Record<string, DbReaction[]>, rx) => {
            if (!acc[rx.message_id]) acc[rx.message_id] = [];
            acc[rx.message_id].push(rx);
            return acc;
        }, {});

        const repliesMap: Record<string, { id: string, content: string, sender_name: string }> = repliesRes.rows.reduce((acc: Record<string, { id: string, content: string, sender_name: string }>, row) => {
            acc[row.id] = row;
            return acc;
        }, {});

        const messages: ChatMessage[] = result.rows.map(row => {
            const dbMsg: DbMessage = {
                ...row,
                attachments: attachmentsMap[row.id] || [],
                reactions: reactionsMap[row.id] || [],
                reply_to: row.reply_to_id ? repliesMap[row.reply_to_id] : undefined
            };
            const normalized = mapMessageToResponse(dbMsg);
            if (normalized) {
                normalized.content = row.content ? decrypt(row.content) : row.content;
                if (normalized.replyTo && dbMsg.reply_to) {
                    normalized.replyTo.content = dbMsg.reply_to.content ? decrypt(dbMsg.reply_to.content) : dbMsg.reply_to.content;
                }
            }
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
    const senderId = user.id;
    const { participantId, content, messageType = 'text', attachment, tempId, attachments } = req.body;
    let { conversationId } = req.body;

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
                conversationId = insertResult.rows[0].id;
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
                conversationId = existing.rows[0].id;
            }
        } else {
            const membershipCheck = await client.query(
                'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
                [conversationId, senderId]
            );

            if (membershipCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return sendError(res, 403, 'Not authorized to send to this conversation');
            }
        }

        const encryptedContent = (content && !content.startsWith('enc:')) ? encrypt(content) : content;
        const decodedPreview = (content && content.startsWith('enc:')) ? await decrypt(content) : content;

        const sequenceNumber = await chatReliabilityService.getNextSequence(conversationId);

        const msgResult = await client.query<DbMessage>(
            `
            INSERT INTO messages (conversation_id, sender_id, sender_role, content, preview_text, message_type, reply_to_id, status, sequence_number)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent', $8)
            RETURNING *
            `,
            [conversationId, senderId, user.role, encryptedContent, decodedPreview, messageType, req.body.replyToId, sequenceNumber]
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
                    content: replyTo.content ? decrypt(replyTo.content) : replyTo.content
                };
            }
        }

        const finalAttachments: { id?: string; url: string; type: string; size: number; name: string; filePath?: string }[] = [];

        // Process all attachments in the pool (Google/Meta Grade Multi-File)
        for (const att of attachmentPool) {
            if (att.url && att.url.includes('/files/temp/')) {
                const innerTempId = att.url.split('/').pop();
                
                // Institutional Move: Atomic staging-to-vault promotion via FileService
                const metadata = await fileService.moveStagedFile(innerTempId, 'chat');
                
                if (!metadata) {
                    logger.warn('[ChatController] Staged attachment promotion failed/missing', { innerTempId, messageId: newMessage.id });
                    continue; // P0 FIX: Skip missing staged files but continue message flow
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
            'UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1',
            [conversationId]
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

        chatReliabilityService.getParticipants(conversationId).then(participants => {
            const others = participants.filter(pid => pid !== senderId);
            let previewText = finalAttachments.length > 0 ? '📎 Attachment' : 'New message';
            if (content) {
                previewText = (decodedPreview.length > 100) ? decodedPreview.substring(0, 100) + '...' : decodedPreview;
            }

            others.forEach(pid => {
                notificationService.create(pid, `New message from ${senderName}`, previewText, 'info')
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
    const user = req.user;
    if (!user || !user.id) return sendError(res, 401, 'Unauthorized');
    const userId = user.id;
    const { participantId } = req.body;

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
            conversationId = insertResult.rows[0].id;
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
                // This state should be unreachable with the UNIQUE constraint, but we handle it safely
                throw new Error('Consistency fracture: Hash exists but conversation not found');
            }
            conversationId = existing.rows[0].id;
        }

        return sendResponse(res, 201, true, 'Conversation established', { conversationId });
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
    const userId = user.id;
    const { conversationId } = req.params as { conversationId: string };

    try {
        await pool.query(
            `
            UPDATE messages 
            SET status = 'delivered', delivered_at = NOW() 
            WHERE conversation_id = $1 AND sender_id != $2 AND status = 'sent'
            `,
            [conversationId, userId]
        );
        if (io) {
            io.to(`conversation:${conversationId}`).emit('messageDelivered', { 
                conversationId, 
                messageIds: [] 
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
    const userId = user.id;
    const { conversationId } = req.params as { conversationId: string };

    try {
        await pool.query(
            `
            UPDATE messages 
            SET status = 'read', read_at = NOW(), is_read = true
            WHERE conversation_id = $1 AND sender_id != $2 AND status != 'read'
            `,
            [conversationId, userId]
        );
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
    const userId = user.id;
    const { messageId } = req.params as { messageId: string };
    const { reactionType } = req.body;

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
    const userId = user.id;
    const { messageId } = req.params as { messageId: string };
    const { forEveryone } = req.body;

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

        if (forEveryone) {
            if (message.sender_id !== userId) {
                return sendError(res, 403, 'Only sender can delete for everyone');
            }

            // P0 FIX: Fetch metadata BEFORE updating DB
            const attachments = await pool.query<DbAttachment>(
                'SELECT file_path FROM message_attachments WHERE message_id = $1 AND deleted_at IS NULL', 
                [messageId]
            );

            // P0 FIX: Institutional Sequence - Soft Delete DB first, then quarantine physical assets
            const deleteTime = new Date().toISOString();
            
            await pool.query(
                'UPDATE message_attachments SET deleted_at = $1 WHERE message_id = $2', 
                [deleteTime, messageId]
            );
            
            await pool.query(
                'UPDATE messages SET deleted_at = $1 WHERE id = $2', 
                [deleteTime, messageId]
            );

            for (const att of attachments.rows) {
                if (att.file_path) {
                    // Background task: Move to quarantine after DB confirms soft-delete
                    fileService.quarantineFile(att.file_path).catch(e => 
                        logger.error('[Forensic-Cleanup] File quarantine failed after soft-delete:', { 
                            path: att.file_path, 
                            error: e.message 
                        })
                    );
                }
            }

            if (io) {
                const deleteData = { messageId, conversationId };
                io.to(`conversation:${conversationId}`).emit('messageDeleted', deleteData);

                // The Governor Mirroring
                io.to('admin:observability').emit('adminMirrorEvent', {
                    event: 'messageDeleted',
                    data: deleteData,
                    timestamp: new Date().toISOString()
                });
            }

            // P0 RECALL: Atomic removal of notifications for this message
            notificationService.recall(messageId).catch(e => 
                logger.error('[Recall-Failure] Automated notification recall failed:', { messageId, error: e.message })
            );
        } else {
            // P0 INSTITUTIONAL FIX: Private Sync for Multi-tab "Delete for Me"
            await pool.query(
                `INSERT INTO deleted_messages (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [messageId, userId]
            );

            if (io) {
                // Scoped emission to only the acting user's private room/sessions
                const localDeleteData = { messageId, conversationId };
                io.to(`user:${userId}`).emit('localMessageDeleted', localDeleteData);

                // The Governor Mirroring
                io.to('admin:observability').emit('adminMirrorEvent', {
                    event: 'localMessageDeleted',
                    data: { ...localDeleteData, userId },
                    timestamp: new Date().toISOString()
                });
                
                logger.info('[ChatController] Private deletion sync emitted.', { userId, messageId });
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
