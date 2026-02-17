import { Request, Response } from 'express';
import { pool } from '../config/db';
import { io } from '../app';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/';
        // Ensure directory exists
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

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
export const uploadAttachment = (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    // Return the URL to the file
    // Assumes server is running on same host/port or behind proxy
    // In production, might want 'process.env.BASE_URL'
    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({
        url: fileUrl,
        type: req.file.mimetype.startsWith('image/') ? 'image' : 'document',
        originalName: req.file.originalname
    });
};

// Get all conversations for the current user
export const getConversations = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    try {
        const result = await pool.query(
            `
            SELECT 
                c.id, 
                c.updated_at,
                c.last_message_at,
                MAX(m.content) as last_message,
                (
                    SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'role', u.role))
                    FROM conversation_participants cp2
                    JOIN users u ON cp2.user_id = u.id
                    WHERE cp2.conversation_id = c.id AND u.id != $1
                ) as participants,
                (
                    SELECT COUNT(*) 
                    FROM messages m2 
                    WHERE m2.conversation_id = c.id AND m2.is_read = false AND m2.sender_id != $1
                ) as unread_count
            FROM conversations c
            JOIN conversation_participants cp ON c.id = cp.conversation_id
            LEFT JOIN messages m ON c.id = m.conversation_id AND m.created_at = c.last_message_at
            WHERE cp.user_id = $1
            GROUP BY c.id
            ORDER BY c.last_message_at DESC
            `,
            [userId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get messages for a specific conversation
export const getMessages = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
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
                m.content, 
                m.sender_id, 
                m.created_at, 
                m.attachment_url, 
                m.attachment_type,
                m.is_read,
                u.name as sender_name
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = $1
            ORDER BY m.created_at ASC
            `,
            [conversationId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Send a message (and optionally start a conversation if ID not provided - logic for frontend to handle ID creation is better, but here we assume ID exists or is created via another endpoint. For simplicity, we assume conversation exists or we can create ad-hoc)
// For this refactor, we'll assume conversation creation happens via a separate 'startConversation' or checked here.
export const sendMessage = async (req: Request, res: Response) => {
    const senderId = (req as any).user.id;
    const { conversationId, content, attachmentUrl, attachmentType } = req.body;

    try {
        // Verify membership
        const membershipCheck = await pool.query(
            'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
            [conversationId, senderId]
        );

        if (membershipCheck.rows.length === 0) {
            return res.status(403).json({ message: 'Not authorized to send to this conversation' });
        }

        const result = await pool.query(
            `
            INSERT INTO messages (conversation_id, sender_id, content, attachment_url, attachment_type)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            `,
            [conversationId, senderId, content, attachmentUrl, attachmentType]
        );

        // Update conversation last_message_at
        await pool.query(
            'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
            [conversationId]
        );

        const newMessage = result.rows[0];

        // Emit socket event to room (conversationId)
        if (io) {
            io.to(conversationId).emit('receive_message', newMessage);
        }

        res.status(201).json(newMessage);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Start a new conversation
export const startConversation = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
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

// Mark messages as read
export const markAsRead = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { conversationId } = req.params;

    try {
        await pool.query(
            `
            UPDATE messages 
            SET is_read = true 
            WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false
            `,
            [conversationId, userId]
        );
        res.sendStatus(200);
    } catch (error) {
        console.error('Error marking read:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
