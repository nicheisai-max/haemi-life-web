// 🔒 HAEMI ATTACHMENT PIPELINE LOCK
// DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL
// SINGLE SOURCE: message_attachments ONLY
// FALLBACKS FORBIDDEN
// TYPESCRIPT STRICT MODE ENFORCED

import { Request, Response } from 'express';
import { pool } from '../config/db';
import { logger } from '../utils/logger';
import { socketIO as io } from '../app';
import { chatReliabilityService } from '../services/chat-reliability.service';
import multer from 'multer';
import * as path from 'path';
import { promises as fs } from 'fs';
import { encrypt, decrypt } from '../utils/security';
import { sendResponse, sendError } from '../utils/response';
import { notificationService } from '../services/notification.service';
import { mapMessageToResponse, mapConversationToResponse } from '../utils/chat.mapper';
import crypto from 'crypto';
import { statusService } from '../services/status.service';
import { getAbsolutePath } from '../utils/path.util';

// 🔒 STRICT UUID VALIDATION (RFC 4122)
const isUUID = (id: string | undefined | null): id is string => {
    if (!id) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
};
// Configure Multer Storage (Centralized Memory Storage preferred for Bytea)
const storage = multer.memoryStorage();

export const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (_req, file, cb) => {
        const mimetype = file.mimetype.toLowerCase();

        // BLOCK: Executable / Dangerous types
        const blockedTypes = [
            'application/x-msdownload', // .exe, .dll, .bat
            'application/x-sh',          // .sh
            'application/x-bat'         // .bat
        ];

        if (blockedTypes.includes(mimetype)) {
            return cb(new Error('Unsupported file type'));
        }

        // ALLOW: Scalable Image/Application/Text support
        if (
            mimetype.startsWith('image/') ||
            mimetype.startsWith('application/') ||
            mimetype.startsWith('text/')
        ) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type'));
        }
    }
});

import { DbMessage, DbConversation, ChatParticipant } from '../types/chat.types';
import { ChatMessage } from '../types/socket.types';

// Upload Attachment Endpoint
export const uploadAttachment = async (req: Request, res: Response) => {
    if (!req.file) {
        return sendError(res, 400, 'No file uploaded');
    }

    try {
        const { originalname, mimetype, buffer } = req.file;
        const fileExt = path.extname(originalname);
        const uniqueFileName = `${crypto.randomUUID()}${fileExt}`;
        const relativePath = `uploads/chat/temp/${uniqueFileName}`;
        const fullPath = getAbsolutePath(relativePath);

        // Ensure directory exists
        const dirPath = path.dirname(fullPath);
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }

        // Write to filesystem
        await fs.writeFile(fullPath, buffer);

        // P0 FIX: Storing BOTH relative path and originalName in the 'name' column
        const stagingMetadata = `${relativePath}|${originalname}`;

        const result = await pool.query(
            'INSERT INTO temp_attachments (data, mime, name) VALUES (NULL, $1, $2) RETURNING id',
            [mimetype, stagingMetadata]
        );

        const tempId = result.rows[0].id;
        const virtualUrl = `/files/temp/${tempId}`;

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
    const user = req.user;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const userId = user.id;

    if (!isUUID(userId)) {
        return sendError(res, 400, 'Invalid or missing userId (UUID expected)');
    }

    try {
        // 1. Fetch Base Conversations (Hard Gate: Message existence required)
        // P0 PROTOCOL: We join with messages to ensure zero ghost leakage.
        const convResult = await pool.query<{ id: string, updated_at: string, last_message_at: string, participants_hash: string, last_message_id: string }>(
            `SELECT DISTINCT ON (c.id) 
                c.id, c.updated_at, m.created_at as last_message_at, c.participants_hash, m.id as last_message_id
             FROM conversations c
             JOIN conversation_participants cp ON c.id = cp.conversation_id
             INNER JOIN messages m ON c.id = m.conversation_id
             WHERE cp.user_id = $1
             ORDER BY c.id, m.created_at DESC`,
            [userId]
        );

        if (convResult.rows.length === 0) {
            return sendResponse(res, 200, true, 'No conversations found', []);
        }

        // Sort by message time (DISTINCT ON required sorting by id first)
        const sortedConvs = convResult.rows.sort((a, b) =>
            new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
        );

        const convIds = sortedConvs.map(c => c.id);

        // 2. Batch Fetch Latest Message Previews
        const msgResult = await pool.query<{ conversation_id: string, preview_text: string }>(
            `SELECT DISTINCT ON (conversation_id) conversation_id, preview_text
             FROM messages
             WHERE conversation_id = ANY($1)
               AND NOT EXISTS (SELECT 1 FROM deleted_messages dm WHERE dm.message_id = messages.id AND dm.user_id = $2)
             ORDER BY conversation_id, created_at DESC`,
            [convIds, userId]
        );
        const lastMsgMap = new Map(msgResult.rows.map(r => [r.conversation_id, r.preview_text]));

        // 3. Batch Fetch Unread Counts
        const unreadResult = await pool.query<{ conversation_id: string, count: string }>(
            `SELECT m.conversation_id, COUNT(*) as count
             FROM messages m
             WHERE m.conversation_id = ANY($1)
               AND m.status != 'read' AND m.sender_id != $2
               AND NOT EXISTS (SELECT 1 FROM deleted_messages dm WHERE dm.message_id = m.id AND dm.user_id = $2)
             GROUP BY m.conversation_id`,
            [convIds, userId]
        );
        const unreadMap = new Map(unreadResult.rows.map(r => [r.conversation_id, parseInt(r.count)]));

        // 4. Batch Fetch Participants (Excluding Self)
        const partResult = await pool.query<{ conversation_id: string, id: string, name: string, role: string, initials: string, profile_image: string | null }>(
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

        // 5. Final Merge (Deterministic)
        const conversations = sortedConvs.map(row => {
            const dbConv: DbConversation = {
                id: row.id,
                updated_at: row.updated_at,
                last_message_at: row.last_message_at,
                participants_hash: row.participants_hash,
                last_message: lastMsgMap.get(row.id) || undefined,
                last_message_id: row.last_message_id,
                participants: partMap.get(row.id) || [],
                unread_count: unreadMap.get(row.id) || 0,
                message_count: 0,
                sequence_counter: 0
            };
            return mapConversationToResponse(dbConv);
        }).filter(Boolean);

        return sendResponse(res, 200, true, 'Conversations fetched (Batch Mode)', conversations);
    } catch (error: unknown) {
        logger.error('[Phase 4] getConversations batch fetch failed:', {
            error: error instanceof Error ? error.message : String(error),
            userId
        });
        return sendError(res, 500, 'Server error during batch fetch');
    }
};

// Get messages for a specific conversation
export const getMessages = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const userId = user.id;
    const { conversationId } = req.params as { conversationId: string };

    // 🔴 FIX 2 & 3: FAIL FAST GUARD & STRICT VALIDATION
    if (!isUUID(conversationId)) {
        return sendError(res, 400, 'Invalid or missing conversationId (UUID expected)');
    }
    if (!isUUID(userId)) {
        return sendError(res, 400, 'Invalid or missing userId (UUID expected)');
    }

    try {
        // 1. Parallelize membership and initial message fetch (O(1) pool usage)
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
        const replyToIds = result.rows.map(m => m.reply_to_id).filter(id => id);

        // 2. Batch fetch attachments, reactions, AND reply_to metadata in parallel
        const [attachmentsRes, reactionsRes, repliesRes] = await Promise.all([
            pool.query(
                `SELECT message_id, file_url as url, file_type as type, file_size as size, file_name as name 
                 FROM message_attachments WHERE message_id = ANY($1)`,
                [messageIds]
            ),
            pool.query(
                `SELECT message_id, reaction_type as type, user_id as "userId" 
                 FROM message_reactions WHERE message_id = ANY($1)`,
                [messageIds]
            ),
            replyToIds.length > 0 ?
                pool.query(
                    `SELECT m.id, m.content, u.name as sender_name
                     FROM messages m LEFT JOIN users u ON m.sender_id = u.id
                     WHERE m.id = ANY($1)`,
                    [replyToIds]
                ) :
                Promise.resolve({ rows: [] })
        ]);

        interface AttachmentsMap { [key: string]: Array<{ url: string, type: string, size: number, name: string }> }
        interface ReactionsMap { [key: string]: Array<{ type: string, userId: string }> }
        interface RepliesMap { [key: string]: { id: string, content: string, sender_name: string } }

        const attachmentsMap = attachmentsRes.rows.reduce((acc: AttachmentsMap, att) => {
            if (!acc[att.message_id]) acc[att.message_id] = [];
            acc[att.message_id].push(att);
            return acc;
        }, {});

        const reactionsMap = reactionsRes.rows.reduce((acc: ReactionsMap, reac) => {
            if (!acc[reac.message_id]) acc[reac.message_id] = [];
            acc[reac.message_id].push(reac);
            return acc;
        }, {});

        const repliesMap = repliesRes.rows.reduce((acc: RepliesMap, rep) => {
            acc[rep.id] = rep;
            return acc;
        }, {});

        // 3. Optimized Combine Loop
        const messages = result.rows.map(msg => {
            msg.attachments = attachmentsMap[msg.id] || [];
            msg.reactions = reactionsMap[msg.id] || [];

            // Map reply metadata if exists
            if (msg.reply_to_id && repliesMap[msg.reply_to_id]) {
                msg.reply_to = repliesMap[msg.reply_to_id];
            }

            const normalized = mapMessageToResponse(msg);
            if (normalized) {
                normalized.content = msg.content ? decrypt(msg.content) : msg.content;
                if (normalized.replyTo && msg.reply_to) {
                    normalized.replyTo.content = msg.reply_to.content ? decrypt(msg.reply_to.content) : msg.reply_to.content;
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

// Send a message (and optionally start a conversation if ID not provided - logic for frontend to handle ID creation is better, but here we assume ID exists or is created via another endpoint. For simplicity, we assume conversation exists or we can create ad-hoc)
// For this refactor, we'll assume conversation creation happens via a separate 'startConversation' or checked here.
export const sendMessage = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const senderId = user.id;
    const { conversationId, content, messageType = 'text', attachment } = req.body;

    // 🔴 FIX 2 & 3: FAIL FAST GUARD & STRICT VALIDATION
    if (!isUUID(conversationId)) {
        return sendError(res, 400, 'Invalid or missing conversationId (UUID expected)');
    }
    if (!isUUID(senderId)) {
        return sendError(res, 400, 'Invalid or missing senderId (UUID expected)');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verify membership
        const membershipCheck = await client.query(
            'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
            [conversationId, senderId]
        );

        if (membershipCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return sendError(res, 403, 'Not authorized to send to this conversation');
        }

        // E2EE: Only encrypt if not already encrypted by the client
        const encryptedContent = (content && !content.startsWith('enc:')) ? encrypt(content) : content;

        // PHASE 3: Plaintext preview for UI (Meta-style)
        // If content is already encrypted (starts with enc:), we decrypt once to get preview
        const decodedPreview = (content && content.startsWith('enc:')) ? await decrypt(content) : content;

        const sequenceNumber = await chatReliabilityService.getNextSequence(conversationId);

        const msgResult = await client.query(
            `
            INSERT INTO messages (conversation_id, sender_id, sender_role, content, preview_text, message_type, reply_to_id, status, sequence_number)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent', $8)
            RETURNING *
            `,
            [conversationId, senderId, user.role, encryptedContent, decodedPreview, messageType, req.body.replyToId, sequenceNumber]
        );

        const newMessage = msgResult.rows[0];

        // Fetch reply_to metadata for the broadcast/response
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

        let attachmentName = attachment?.originalName || 'attachment';
        if (attachment && attachment.url) {
            // Check if it's a temp virtual URL (Handle both /api/files/temp/ and /files/temp/ variants)
            if (attachment.url.includes('/files/temp/')) {
                const tempId = attachment.url.split('/').pop();
                const tempResult = await client.query(
                    'SELECT data, mime, name FROM temp_attachments WHERE id = $1',
                    [tempId]
                );
                if (tempResult.rows.length > 0) {
                    const stagingMetadata = tempResult.rows[0].name;
                    const [tempFilePath, originalName] = stagingMetadata.split('|');

                    // P0 FIX: Use the preserved originalName from staging instead of basename(uuid)
                    attachmentName = originalName || path.basename(tempFilePath);

                    // Move from temp to permanent chat storage
                    const permanentPath = tempFilePath.replace('/temp/', '/');
                    const fullTempPath = getAbsolutePath(tempFilePath);
                    const fullPermanentPath = getAbsolutePath(permanentPath);

                    try {
                        await fs.access(fullTempPath);
                        const permDir = path.dirname(fullPermanentPath);
                        try {
                            await fs.access(permDir);
                        } catch {
                            await fs.mkdir(permDir, { recursive: true });
                        }
                        await fs.rename(fullTempPath, fullPermanentPath);
                        
                        // NUCLEAR FIX: Calculate REAL file size from filesystem
                        const stats = await fs.stat(fullPermanentPath);
                        const fileSize = stats.size;
                        
                        // FINAL HARDENING: Extension derivation REMOVED. MIME is the only truth.
                        let fileCat = 'other';
                        if (attachment.type.startsWith('image/')) {
                            fileCat = 'image';
                        } else if (
                            attachment.type.startsWith('application/') ||
                            attachment.type.startsWith('text/')
                        ) {
                            fileCat = 'document';
                        }
                        
                        attachment.url = permanentPath;

                        // P0 NUCLEAR: Atomic write to message_attachments ONLY
                        const attResult = await client.query(
                            `INSERT INTO message_attachments (message_id, file_url, file_type, file_name, file_size, file_extension, file_category) 
                             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                            [newMessage.id, attachment.url, attachment.type, attachmentName, fileSize, null, fileCat]
                        );

                        const attachmentId = attResult.rows[0].id;

                        // Set the correct public URL for emission
                        attachment.url = `/files/message/${attachmentId}`;
                        attachment.name = attachmentName;
                        attachment.size = fileSize;
                    } catch (err) {
                        logger.error('[Phase 5] Attachment move failed - NO ATTACHMENT RECORDED', { fullTempPath, err });
                    }

                    // Clean up temp record
                    await client.query('DELETE FROM temp_attachments WHERE id = $1', [tempId]);
                }
            }
        }

        newMessage.reactions = [];

        // Update conversation last_message_at
        await client.query(
            'UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1',
            [conversationId]
        );

        await client.query('COMMIT');

        // Decrypt content for response and socket emission
        // We stored encrypted, so decrypt it back for the user/socket
        newMessage.content = content; // Optimistic: we know what we sent

        const senderName = user.name || 'Someone';

        // Emit socket event to room (conversationId) for active UI sync
        // AND emit to each participant's personal room for global widget/badge sync
        // ENTERPRISE HARDENING: Standardized Event Emission from message_attachments
        const attachmentsArr = (attachment && attachment.url && !attachment.url.includes('/uploads/')) ? [
            {
                url: attachment.url,
                type: attachment.type || 'document',
                size: attachment.size || 0,
                name: attachmentName
            }
        ] : [];

        // Attach to the message object for REST response and socket emission
        newMessage.attachments = attachmentsArr;

        const socketPayload: ChatMessage | null = mapMessageToResponse({
            ...newMessage,
            sender_name: senderName,
            sender_role: user.role,
            attachments: attachmentsArr
        });

        // Standardized Enterprise Event: messageReceived
        // Emitted once to the conversation room for real-time delivery
        if (io && socketPayload) {
            io.to(`conversation:${conversationId}`).emit('messageReceived', socketPayload);
            logger.info('[ChatController] Message emitted to room', { conversationId, messageId: newMessage.id });
        }

        // 4. NON-BLOCKING: Emit real-time notifications to other participants
        // P0 NUCLEAR: Unique user emission only. notificationService handles persistence + socket.
        chatReliabilityService.getParticipants(conversationId).then(participants => {
            const uniqueParticipants = [...new Set(participants)];
            const others = uniqueParticipants.filter(pid => pid !== senderId);
            let previewText = '📎 Attachment';
            if (content) {
                const dec = (decodedPreview.length > 100) ? decodedPreview.substring(0, 100) + '...' : decodedPreview;
                previewText = dec;
            }

            others.forEach(pid => {
                notificationService.create(
                    pid,
                    `New message from ${senderName}`,
                    previewText,
                    'info'
                ).catch(err => logger.error('[Phase 3] Background notification failed:', err));
            });
        }).catch(err => logger.error('[Phase 3] Participant lookup failed:', err));

        return sendResponse(res, 201, true, 'Message sent', socketPayload);
    } catch (error: unknown) {
        await client.query('ROLLBACK');
        logger.error('[Phase 5] sendMessage error:', {
            error: error instanceof Error ? error.message : String(error),
            conversationId,
            senderId
        });
        return sendError(res, 500, 'Server error sending message');
    } finally {
        client.release();
    }
};

// Start a new conversation
export const startConversation = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const userId = user.id;
    const { participantId } = req.body;

    if (!participantId) return sendError(res, 400, 'Participant ID required');

    try {
        // P0 PROTOCOL: Atomic Uniqueness Check via participants_hash
        const sortedIds = [userId, participantId].sort();
        const hashBase = sortedIds.join(':');
        const participantsHash = crypto.createHash('sha256').update(hashBase).digest('hex');

        // 1. Try to INSERT (Atomic check)
        const insertResult = await pool.query(
            `INSERT INTO conversations (participants_hash) 
             VALUES ($1) 
             ON CONFLICT (participants_hash) DO NOTHING 
             RETURNING id`,
            [participantsHash]
        );

        let conversationId: string;

        if (insertResult.rows.length > 0) {
            conversationId = insertResult.rows[0].id;
            // 2. Add participants ONLY for new conversation
            await pool.query(
                'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
                [conversationId, userId, participantId]
            );
            logger.info('[ChatController] Created new conversation', { conversationId, participantsHash });
        } else {
            // 3. Fetch existing ID if conflict occurred
            const existing = await pool.query(
                'SELECT id FROM conversations WHERE participants_hash = $1',
                [participantsHash]
            );
            conversationId = existing.rows[0].id;
            logger.info('[ChatController] Found existing conversation', { conversationId });
        }

        return sendResponse(res, 201, true, 'Conversation started', { conversationId });
    } catch (error: unknown) {
        logger.error('[ChatController] startConversation error:', {
            error: error instanceof Error ? error.message : String(error),
            userId,
            participantId
        });
        return sendError(res, 500, 'Server error during conversation creation');
    }
};

// Mark messages as delivered
export const markAsDelivered = async (req: Request, res: Response) => {
    const user = req.user;
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
        // P0 NUCLEAR: REMOVED controller-side emission to eliminate redundant events.
        // Delivery receipts are now handled exclusively via conversational room broadcast.


        sendResponse(res, 200, true, 'Messages marked as delivered');
    } catch (error: unknown) {
        logger.error('Error marking delivered:', {
            error: error instanceof Error ? error.message : String(error),
            conversationId,
            userId
        });
        return sendError(res, 500, 'Server error');
    }
};

// Mark messages as read
export const markAsRead = async (req: Request, res: Response) => {
    const user = req.user;
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
        // P0 NUCLEAR: REMOVED controller-side emission to eliminate redundant events.
        // Read receipts are handled exclusively via the socket 'message:read' listener.


        sendResponse(res, 200, true, 'Messages marked as read');
    } catch (error: unknown) {
        logger.error('Error marking read:', {
            error: error instanceof Error ? error.message : String(error),
            conversationId,
            userId
        });
        return sendError(res, 500, 'Server error');
    }
};

// React to a Message
export const reactToMessage = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const userId = user.id;
    const { messageId } = req.params as { messageId: string };
    const { reactionType } = req.body; // e.g. 'like', 'love'

    try {
        // Find conversation ID and verify participation
        const msgResult = await pool.query(
            `SELECT m.conversation_id FROM messages m 
             JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id 
             WHERE m.id = $1 AND cp.user_id = $2`,
            [messageId, userId]
        );

        if (msgResult.rows.length === 0) {
            return sendError(res, 403, 'Not authorized or message not found');
        }

        const conversationId = msgResult.rows[0].conversation_id;

        // Check if user already has THIS reaction
        const existing = await pool.query(
            'SELECT 1 FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND reaction_type = $3',
            [messageId, userId, reactionType]
        );

        if (existing.rows.length > 0) {
            // TOGGLE: Remove reaction
            await pool.query(
                'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND reaction_type = $3',
                [messageId, userId, reactionType]
            );
            if (io) {
                const payload = {
                    messageId: messageId as string,
                    userId,
                    reactionType: reactionType as string,
                    action: 'removed' as const
                };
                // P0 NUCLEAR: Reactions MUST go ONLY to the conversation room.
                io.to(`conversation:${conversationId}`).emit('messageReaction', payload);
            }
        } else {
            // TOGGLE: Add or update (one reaction per user per message - if they want to switch, we delete all then add)
            // But requirement says "Allow user to change reaction", let's clear existing and add new
            await pool.query('DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2', [messageId, userId]);
            await pool.query(
                'INSERT INTO message_reactions (message_id, user_id, reaction_type) VALUES ($1, $2, $3)',
                [messageId, userId, reactionType]
            );
            if (io) {
                const payload = {
                    messageId: messageId as string,
                    userId,
                    reactionType: reactionType as string,
                    action: 'added' as const
                };
                // P0 NUCLEAR: Reactions MUST go ONLY to the conversation room.
                io.to(`conversation:${conversationId}`).emit('messageReaction', payload);
            }
        }

        sendResponse(res, 200, true, 'Reaction updated');
    } catch (error: unknown) {
        logger.error('Error reacting to message:', {
            error: error instanceof Error ? error.message : String(error),
            messageId,
            userId
        });
        return sendError(res, 500, 'Server error');
    }
};

// Delete Message
export const deleteMessage = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const userId = user.id;
    const { messageId } = req.params as { messageId: string };
    const { forEveryone } = req.body;

    try {
        // Verify participation
        const msgCheck = await pool.query(
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

            // Hard delete attachments strictly via message_attachments
            try {
                const attachments = await pool.query<{ file_url: string }>('SELECT file_url FROM message_attachments WHERE message_id = $1', [messageId]);
                for (const att of attachments.rows) {
                    if (att.file_url) {
                        const filePath = getAbsolutePath(att.file_url);
                        try {
                            await fs.access(filePath);
                            await fs.unlink(filePath);
                        } catch {
                            // File doesn't exist, skip
                        }
                    }
                }
            } catch (err) {
                logger.error('[ChatController] Attachment cleanup failed:', err);
            }

            // Update database: hard delete message (which removes BYTEA data atomically)
            await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);


            if (io) {
                const payload = {
                    messageId: messageId as string,
                    conversationId: conversationId as string,
                    forEveryone: true
                };
                // P0 NUCLEAR: Standardized prefix 'conversation:' to ensure delivery
                io.to(`conversation:${conversationId}`).emit('message:deleted', payload);
                logger.info('[ChatController] Message deleted (Broadcast)', { conversationId, messageId });
            }
        } else {
            // Delete for me
            await pool.query(
                `INSERT INTO deleted_messages (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [messageId, userId]
            );
        }

        return sendResponse(res, 200, true, 'Message deleted');
    } catch (error: unknown) {
        logger.error('[ChatController] Error deleting message:', {
            error: error instanceof Error ? error.message : String(error),
            messageId,
            userId
        });
        return sendError(res, 500, 'Server error during deletion');
    }
};

// Get presence status for a batch of users
export const getPresence = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return sendError(res, 401, 'Unauthorized');

    const { userIds } = req.query;
    if (!userIds || typeof userIds !== 'string') {
        return sendError(res, 400, 'User IDs required as comma-separated string');
    }

    try {
        const ids = userIds.split(',').filter(id => id.length > 0);
        // P0 PROTOCOL: EXACT ID MATCHING (NO NORMALIZATION)
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

// Sync Chat (Offline Recovery)
export const syncChat = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    const since = req.query.since as string; // ISO timestamp

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

        const result = await pool.query(syncQuery, [user.id, since]);

        const formatted = result.rows.map(mapMessageToResponse);

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
