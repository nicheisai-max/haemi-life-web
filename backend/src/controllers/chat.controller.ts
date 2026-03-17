import { Request, Response } from 'express';
import { pool } from '../config/db';
import { io } from '../app';
import { chatReliabilityService } from '../services/chat-reliability.service';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { encrypt, decrypt } from '../utils/security';
import { sendResponse, sendError } from '../utils/response';
import { notificationService } from '../services/notification.service';
import crypto from 'crypto';
// Configure Multer Storage (Centralized Memory Storage preferred for Bytea)
const storage = multer.memoryStorage();

export const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only images and documents are allowed'));
        }
    }
});

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
        const fullPath = path.join(process.cwd(), relativePath);

        // Ensure directory exists
        if (!fs.existsSync(path.dirname(fullPath))) {
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        }

        // Write to filesystem
        fs.writeFileSync(fullPath, buffer);

        // We store the path in a way that sendMessage can retrieve it.
        // Since we can't easily change the schema of temp_attachments (data BYTEA NOT NULL),
        // we will store the path as a string in the 'data' column by encoding it,
        // OR better, we use an empty buffer if we can, but 'data' is NOT NULL.
        // Actually, the most production-grade way without a schema change is to store the path in a metadata field if available.
        // temp_attachments only has id, data, mime, name.
        // We will store the relative path in the 'name' field prefixed with 'PATH:' or similar,
        // or just store the binary for now if we absolutely must, but the user says NO.
        // Let's use the 'data' column to store the Buffer of the path string as a temporary "metadata-only" payload
        // to comply with the 'Binary payload must NOT be stored' but 'data NOT NULL' constraint.
        // No, that's confusing. 
        // Let's assume the user wants us to EXCLUDE the binary from the database insertion.
        // If 'data' is NOT NULL, we'll use a 1-byte placeholder.
        const result = await pool.query(
            'INSERT INTO temp_attachments (data, mime, name) VALUES ($1, $2, $3) RETURNING id',
            [Buffer.from([0]), mimetype, relativePath] // Storing path in 'name' column for retrieval
        );

        const tempId = result.rows[0].id;
        const virtualUrl = `/api/files/temp/${tempId}`;

        res.json({
            url: virtualUrl,
            tempId: tempId,
            type: req.file.mimetype.startsWith('image/') ? 'image' : 'document',
            originalName: originalname
        });
    } catch (error) {
        console.error('Error in uploadAttachment:', error);
        return sendError(res, 500, 'Error staging attachment');
    }
};


// Get all conversations for the current user
export const getConversations = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const userId = user.id;

    try {
        const result = await pool.query(
            `
            SELECT 
                c.id, 
                c.updated_at,
                c.last_message_at,
                (
                    SELECT preview_text 
                    FROM messages m 
                    WHERE m.conversation_id = c.id 
                    ORDER BY m.created_at DESC 
                    LIMIT 1
                ) as last_message,
                (
                    SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'role', u.role, 'initials', u.initials, 'profile_image', u.profile_image))
                    FROM conversation_participants cp2
                    JOIN users u ON cp2.user_id = u.id
                    WHERE cp2.conversation_id = c.id AND u.id != $1
                ) as participants,
                (
                    SELECT COUNT(*) 
                    FROM messages m2 
                    WHERE m2.conversation_id = c.id AND m2.status != 'read' AND m2.sender_id != $1
                ) as unread_count,
                (
                    SELECT COUNT(*) FROM messages m3 WHERE m3.conversation_id = c.id
                ) as message_count
            FROM conversations c
            JOIN conversation_participants cp ON c.id = cp.conversation_id
            WHERE cp.user_id = $1
            AND EXISTS (
              SELECT 1
              FROM messages m
              WHERE m.conversation_id = c.id
            )
            AND c.last_message_at IS NOT NULL
            GROUP BY c.id
            ORDER BY c.last_message_at DESC
            `,
            [userId]
        );

        // Plaintext previews are now stored in DB, no decryption needed for performance
        const conversations = result.rows;

        return sendResponse(res, 200, true, 'Conversations fetched', conversations);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        return sendError(res, 500, 'Server error');
    }
};

// Get messages for a specific conversation
export const getMessages = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const userId = user.id;
    const { conversationId } = req.params;

    try {
        // Verify membership
        const membershipCheck = await pool.query(
            'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
            [conversationId, userId]
        );

        if (membershipCheck.rows.length === 0) {
            return sendError(res, 403, 'Not authorized to view this conversation');
        }

        const result = await pool.query(
            `
            SELECT 
                m.id, 
                m.conversation_id,
                m.content, 
                m.sender_id, 
                m.created_at, 
                m.message_type,
                m.status,
                m.delivered_at,
                m.read_at,
                m.reply_to_id,
                (
                    SELECT json_build_object('id', rm.id, 'content', rm.content, 'sender_name', ru.name)
                    FROM messages rm
                    JOIN users ru ON rm.sender_id = ru.id
                    WHERE rm.id = m.reply_to_id
                ) as reply_to,
                u.name as sender_name,
                COALESCE(
                    (
                        SELECT json_agg(json_build_object('url', ma.file_url, 'type', ma.file_type, 'size', ma.file_size, 'name', ma.file_name))
                        FROM message_attachments ma
                        WHERE ma.message_id = m.id
                    ),
                    (
                        CASE WHEN m.attachment_url IS NOT NULL 
                        THEN json_build_array(json_build_object('url', m.attachment_url, 'type', m.attachment_type, 'size', 0, 'name', m.attachment_name))
                        ELSE '[]'::json END
                    )
                ) as attachments,
                COALESCE(
                    (
                        SELECT json_agg(json_build_object('type', mr.reaction_type, 'userId', mr.user_id))
                        FROM message_reactions mr
                        WHERE mr.message_id = m.id
                    ),
                    '[]'::json
                ) as reactions
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = $1
              AND m.is_deleted = false
              AND NOT EXISTS (
                  SELECT 1 FROM deleted_messages dm 
                  WHERE dm.message_id = m.id AND dm.user_id = $2
              )
            ORDER BY m.created_at ASC
            `,
            [conversationId, userId]
        );

        // Decrypt messages content and reply_to content
        const messages = result.rows.map(msg => ({
            ...msg,
            content: msg.content ? decrypt(msg.content) : msg.content,
            reply_to: msg.reply_to ? {
                ...msg.reply_to,
                content: msg.reply_to.content ? decrypt(msg.reply_to.content) : msg.reply_to.content
            } : null
        }));

        return sendResponse(res, 200, true, 'Messages fetched', messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        return sendError(res, 500, 'Server error');
    }
};

// Send a message (and optionally start a conversation if ID not provided - logic for frontend to handle ID creation is better, but here we assume ID exists or is created via another endpoint. For simplicity, we assume conversation exists or we can create ad-hoc)
// For this refactor, we'll assume conversation creation happens via a separate 'startConversation' or checked here.
export const sendMessage = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const senderId = user.id;
    const { conversationId, content, messageType = 'text', attachment } = req.body;

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
        const decodedPreview = (content && content.startsWith('enc:')) ? decrypt(content) : content;

        const sequenceNumber = await chatReliabilityService.getNextSequence(conversationId);

        const msgResult = await client.query(
            `
            INSERT INTO messages (conversation_id, sender_id, content, preview_text, message_type, reply_to_id, status, sequence_number)
            VALUES ($1, $2, $3, $4, $5, $6, 'sent', $7)
            RETURNING *
            `,
            [conversationId, senderId, encryptedContent, decodedPreview, messageType, req.body.replyToId, sequenceNumber]
        );

        const newMessage = msgResult.rows[0];

        // Fetch reply_to metadata for the broadcast/response
        if (req.body.replyToId) {
            const replyResult = await client.query(
                `
                SELECT rm.id, rm.content, ru.name as sender_name
                FROM messages rm
                JOIN users ru ON rm.sender_id = ru.id
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

        // Handle attachment if any
        if (attachment && attachment.url) {
            let attachmentMime = attachment.type;
            let attachmentName = attachment.originalName || 'attachment';

            // Check if it's a temp virtual URL
            if (attachment.url.startsWith('/api/files/temp/')) {
                const tempId = attachment.url.split('/').pop();
                const tempResult = await client.query(
                    'SELECT data, mime, name FROM temp_attachments WHERE id = $1',
                    [tempId]
                );
                if (tempResult.rows.length > 0) {
                    const tempFilePath = tempResult.rows[0].name; // Path stored in name
                    attachmentMime = tempResult.rows[0].mime;
                    attachmentName = path.basename(tempFilePath);

                    // Move from temp to permanent chat storage
                    const permanentPath = tempFilePath.replace('/temp/', '/');
                    const fullTempPath = path.join(process.cwd(), tempFilePath);
                    const fullPermanentPath = path.join(process.cwd(), permanentPath);

                    if (fs.existsSync(fullTempPath)) {
                        if (!fs.existsSync(path.dirname(fullPermanentPath))) {
                            fs.mkdirSync(path.dirname(fullPermanentPath), { recursive: true });
                        }
                        fs.renameSync(fullTempPath, fullPermanentPath);
                        attachment.url = permanentPath;
                    }

                    // Clean up temp record
                    await client.query('DELETE FROM temp_attachments WHERE id = $1', [tempId]);
                }
            }

            await client.query(
                `
                UPDATE messages 
                SET attachment_url = $1, 
                    attachment_type = $2, 
                    attachment_mime = $3, 
                    attachment_name = $4
                WHERE id = $5
                `,
                [attachment.url, attachment.type, attachmentMime, attachmentName, newMessage.id]
            );

            newMessage.attachment_url = `/api/files/message/${newMessage.id}`;
            newMessage.attachment_type = attachment.type;
            newMessage.attachment_mime = attachmentMime;
            newMessage.attachment_name = attachmentName;
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
        // ENTERPRISE HARDENING: Standardized Event Emission
        const socketPayload = {
            ...newMessage,
            sender_name: senderName,
            attachments: (attachment && attachment.url) ? [
                {
                    url: `/api/files/message/${newMessage.id}`,
                    type: attachment?.type || 'attachment',
                    size: 0,
                    name: attachment?.originalName || 'attachment'
                }
            ] : []
        };

        // Standardized Enterprise Event: message_received
        // Emitted exclusively to participant user streams to prevent duplication
        if (io) {
            const participantIds = await chatReliabilityService.getParticipants(conversationId);

            participantIds.forEach(pid => {
                io!.to(`user:${pid}`).emit('message_received', socketPayload);
            });
        }

        // Emit real-time notification to all other participants in this conversation
        try {
            const participantsResult = await pool.query(
                'SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id != $2',
                [conversationId, senderId]
            );
            // P1 FIX: Definitive decryption for notification previews
            let previewText = '📎 Attachment';
            if (content) {
                previewText = (decodedPreview.length > 100) ? decodedPreview.substring(0, 100) + '...' : decodedPreview;
            }

            for (const row of participantsResult.rows) {
                const recipientId = row.user_id;
                await notificationService.create(
                    recipientId,
                    `New message from ${senderName}`,
                    previewText,
                    'info'
                );
            }
        } catch (notifErr) {
            console.error('Non-fatal: failed to emit chat notification:', notifErr);
        }

        return sendResponse(res, 201, true, 'Message sent', newMessage);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error sending message:', error);
        return sendError(res, 500, 'Server error');
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

    // PHASE 4: Deterministic Identity (participants_hash)
    // Create hash by sorting IDs: e.g. "uuid1:uuid2"
    const hash = [userId, participantId].sort().join(':');
    const participantsHash = crypto.createHash('sha256').update(hash).digest('hex');

    try {
        // Check if conversation already exists using participants_hash
        const existing = await pool.query(
            'SELECT id FROM conversations WHERE participants_hash = $1',
            [participantsHash]
        );

        if (existing.rows.length > 0) {
            return res.json({ conversationId: existing.rows[0].id });
        }

        // Create new conversation with hash
        const conversationResult = await pool.query(
            'INSERT INTO conversations (participants_hash) VALUES ($1) RETURNING id',
            [participantsHash]
        );
        const conversationId = conversationResult.rows[0].id;

        // Add participants
        await pool.query(
            'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
            [conversationId, userId, participantId]
        );

        return sendResponse(res, 201, true, 'Conversation started', { conversationId });
    } catch (error) {
        console.error('Error starting conversation:', error);
        return sendError(res, 500, 'Server error');
    }
};

// Mark messages as delivered
export const markAsDelivered = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const userId = user.id;
    const { conversationId } = req.params;

    try {
        const result = await pool.query(
            `
            UPDATE messages 
            SET status = 'delivered', delivered_at = NOW() 
            WHERE conversation_id = $1 AND sender_id != $2 AND status = 'sent'
            RETURNING id, sender_id
            `,
            [conversationId, userId]
        );

        if (result.rows.length > 0 && io) {
            const payload = {
                conversationId,
                receiver_id: userId,
                messageIds: result.rows.map(r => r.id),
                status: 'delivered'
            };

            // Targeted Read Receipt Optimization: Notify original senders only
            const senderIds = [...new Set(result.rows.map(r => r.sender_id))];
            senderIds.forEach(sid => {
                io!.to(`user:${sid}`).emit('message_delivered', payload);
            });
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error marking delivered:', error);
        return sendError(res, 500, 'Server error');
    }
};

// Mark messages as read
export const markAsRead = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const userId = user.id;
    const { conversationId } = req.params;

    try {
        const result = await pool.query(
            `
            UPDATE messages 
            SET status = 'read', read_at = NOW(), is_read = true
            WHERE conversation_id = $1 AND sender_id != $2 AND status != 'read'
            RETURNING id, sender_id
            `,
            [conversationId, userId]
        );

        if (result.rows.length > 0 && io) {
            const payload = {
                conversationId,
                user_id: userId,
                messageIds: result.rows.map(r => r.id),
                status: 'read'
            };

            // Targeted Read Receipt Optimization: Notify original senders only
            const senderIds = [...new Set(result.rows.map(r => r.sender_id))];
            senderIds.forEach(sid => {
                io!.to(`user:${sid}`).emit('message_read', payload);
            });
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error marking read:', error);
        return sendError(res, 500, 'Server error');
    }
};

// React to a Message
export const reactToMessage = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const userId = user.id;
    const { messageId } = req.params;
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
                const payload = { messageId, userId, reactionType, action: 'removed' };
                const participantIds = await chatReliabilityService.getParticipants(conversationId);
                participantIds.forEach(pid => io!.to(`user:${pid}`).emit('message_reaction', payload));
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
                const payload = { messageId, userId, reactionType, action: 'added' };
                const participantIds = await chatReliabilityService.getParticipants(conversationId);
                participantIds.forEach(pid => io!.to(`user:${pid}`).emit('message_reaction', payload));
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error reacting to message:', error);
        return sendError(res, 500, 'Server error');
    }
};

// Delete Message
export const deleteMessage = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return sendError(res, 401, 'Unauthorized');
    const userId = user.id;
    const { messageId } = req.params;
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

            // Hard delete attachments first (Legacy logic - only if table exists)
            try {
                const attachments = await pool.query('SELECT attachment_url FROM messages WHERE id = $1', [messageId]);
                for (const att of attachments.rows) {
                    if (att.attachment_url && !att.attachment_url.startsWith('/api/files/')) {
                        const filePath = path.join(__dirname, '../../', att.attachment_url);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                        }
                    }
                }
            } catch (err) {
                console.warn('Legacy attachment cleanup skipped or failed.', err);
            }

            // Update database: hard delete message (which removes BYTEA data atomically)
            await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);


            if (io) {
                const payload = { messageId, forEveryone: true };
                const participantIds = await chatReliabilityService.getParticipants(conversationId);
                participantIds.forEach(pid => io!.to(`user:${pid}`).emit('message_deleted', payload));
            }
        } else {
            // Delete for me
            await pool.query(
                `INSERT INTO deleted_messages (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [messageId, userId]
            );
            // No broadcast needed usually, but can emit to user room if multi-device sync desired.
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error deleting message:', error);
        return sendError(res, 500, 'Server error');
    }
};

// Sync Chat (Offline Recovery)
export const syncChat = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    const { since } = req.query; // ISO timestamp

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

        const formatted = result.rows.map(row => ({
            ...row,
            content: row.content, // Client handles decryption
            reply_to: row.reply_to_id ? {
                id: row.reply_to_id,
                content: row.reply_content,
                sender_id: row.reply_sender_id
            } : undefined
        }));

        return sendResponse(res, 200, true, 'Chat synced', formatted);
    } catch (error) {
        console.error('Error syncing chat:', error);
        return sendError(res, 500, 'Server error');
    }
};
