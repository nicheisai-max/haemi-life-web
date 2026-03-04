import { Request, Response } from 'express';
import { pool } from '../config/db';
import { io } from '../app';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { encrypt, decrypt } from '../utils/security';
import { notificationService } from '../services/notification.service';
import { sendError } from '../utils/response';
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
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO temp_attachments (data, mime, name) VALUES ($1, $2, $3) RETURNING id',
            [req.file.buffer, req.file.mimetype, req.file.originalname]
        );

        const tempId = result.rows[0].id;
        const virtualUrl = `/api/files/temp/${tempId}`;

        res.json({
            url: virtualUrl,
            tempId: tempId,
            type: req.file.mimetype.startsWith('image/') ? 'image' : 'document',
            originalName: req.file.originalname
        });
    } catch (error) {
        console.error('Error in uploadAttachment:', error);
        res.status(500).json({ message: 'Error staging attachment' });
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
                    SELECT content 
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
            GROUP BY c.id
            ORDER BY c.last_message_at DESC NULLS LAST
            `,
            [userId]
        );

        // Decrypt last message content if present
        const conversations = result.rows.map(conv => ({
            ...conv,
            last_message: conv.last_message ? decrypt(conv.last_message) : null
        }));

        res.json(conversations);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ message: 'Server error' });
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
            return res.status(403).json({ message: 'Not authorized to view this conversation' });
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

        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Server error' });
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
            return res.status(403).json({ message: 'Not authorized to send to this conversation' });
        }

        // E2EE: Only encrypt if not already encrypted by the client
        const encryptedContent = (content && !content.startsWith('enc:')) ? encrypt(content) : content;

        // Decrypt for preview (plaintext in notifications table)
        const previewContent = content && content.startsWith('enc:') ? decrypt(content) : content;

        const msgResult = await client.query(
            `
            INSERT INTO messages (conversation_id, sender_id, content, message_type, reply_to_id, status)
            VALUES ($1, $2, $3, $4, $5, 'sent')
            RETURNING *
            `,
            [conversationId, senderId, encryptedContent, messageType, req.body.replyToId]
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
            let attachmentData = null;
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
                    attachmentData = tempResult.rows[0].data;
                    attachmentMime = tempResult.rows[0].mime;
                    attachmentName = tempResult.rows[0].name;

                    // Clean up temp storage
                    await client.query('DELETE FROM temp_attachments WHERE id = $1', [tempId]);
                }
            }

            await client.query(
                `
                UPDATE messages 
                SET attachment_url = $1, 
                    attachment_type = $2, 
                    attachment_data = $3, 
                    attachment_mime = $4, 
                    attachment_name = $5
                WHERE id = $6
                `,
                [attachment.url, attachment.type, attachmentData, attachmentMime, attachmentName, newMessage.id]
            );

            newMessage.attachment_url = `/api/files/message/${newMessage.id}`;
            newMessage.attachment_type = attachment.type;

            newMessage.attachment_data = attachmentData;
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

        // Emit socket event to room (conversationId)
        if (io) {
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
            io.to(`conversation:${conversationId}`).emit('receive_message', socketPayload);
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
                previewText = (previewContent.length > 100) ? previewContent.substring(0, 100) + '...' : previewContent;
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

        res.status(201).json(newMessage);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Server error' });
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

    try {
        // Check if conversation already exists between these two
        // precise logic: find a conversation where BOTH are participants and count of participants is 2 (for 1-on-1)
        const existing = await pool.query(
            `
            SELECT c.id 
            FROM conversations c
            JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
            JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
            WHERE cp1.user_id = $1 AND cp2.user_id = $2
            GROUP BY c.id
            HAVING COUNT(DISTINCT cp1.user_id) = 2 -- simplified check
            `,
            [userId, participantId]
        );

        if (existing.rows.length > 0) {
            return res.json({ conversationId: existing.rows[0].id });
        }

        // Create new conversation
        const conversationResult = await pool.query(
            'INSERT INTO conversations DEFAULT VALUES RETURNING id'
        );
        const conversationId = conversationResult.rows[0].id;

        // Add participants
        await pool.query(
            'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
            [conversationId, userId, participantId]
        );

        res.status(201).json({ conversationId });
    } catch (error) {
        console.error('Error starting conversation:', error);
        res.status(500).json({ message: 'Server error' });
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
            // Notify the sender(s) that their messages were delivered
            io.to(`conversation:${conversationId}`).emit('messages_delivered', {
                conversation_id: conversationId,
                receiver_id: userId,
                message_ids: result.rows.map(r => r.id)
            });
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error marking delivered:', error);
        res.status(500).json({ message: 'Server error' });
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
            // Notify the sender(s) that their messages were read
            io.to(`conversation:${conversationId}`).emit('messages_read', {
                conversation_id: conversationId,
                receiver_id: userId,
                message_ids: result.rows.map(r => r.id)
            });
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error marking read:', error);
        res.status(500).json({ message: 'Server error' });
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
            return res.status(403).json({ message: 'Not authorized or message not found' });
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
            if (io) io.to(`conversation:${conversationId}`).emit('message_reaction', { messageId, userId, reactionType, action: 'removed' });
        } else {
            // TOGGLE: Add or update (one reaction per user per message - if they want to switch, we delete all then add)
            // But requirement says "Allow user to change reaction", let's clear existing and add new
            await pool.query('DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2', [messageId, userId]);
            await pool.query(
                'INSERT INTO message_reactions (message_id, user_id, reaction_type) VALUES ($1, $2, $3)',
                [messageId, userId, reactionType]
            );
            if (io) io.to(`conversation:${conversationId}`).emit('message_reaction', { messageId, userId, reactionType, action: 'added' });
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error reacting to message:', error);
        res.status(500).json({ message: 'Server error' });
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
            return res.status(403).json({ message: 'Not authorized or message not found' });
        }

        const message = msgCheck.rows[0];
        const conversationId = message.conversation_id;

        if (forEveryone) {
            if (message.sender_id !== userId) {
                return res.status(403).json({ message: 'Only sender can delete for everyone' });
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


            if (io) io.to(`conversation:${conversationId}`).emit('message_deleted', { messageId, forEveryone: true });
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
        res.status(500).json({ message: 'Server error' });
    }
};
