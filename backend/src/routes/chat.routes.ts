import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { getConversations, getMessages, sendMessage, startConversation, markAsRead, uploadAttachment, upload, reactToMessage, deleteMessage, markAsDelivered } from '../controllers/chat.controller';

const router = Router();

// Retrieve all conversations for the user
router.get('/conversations', authenticateToken, getConversations);

// Retrieve messages for a conversation
router.get('/messages/:conversationId', authenticateToken, getMessages);

// Send a message
router.post('/messages', authenticateToken, sendMessage);

// Upload Attachment
router.post('/attachments', authenticateToken, upload.single('file'), uploadAttachment);

// Start a new conversation
router.post('/conversations', authenticateToken, startConversation);

// Mark as read (Update for Read Receipts)
router.put('/conversations/:conversationId/read', authenticateToken, markAsRead);

// Mark as delivered
router.put('/conversations/:conversationId/delivered', authenticateToken, markAsDelivered);

// React to a message
router.post('/messages/:messageId/react', authenticateToken, reactToMessage);

// Delete a message
router.post('/messages/:messageId/delete', authenticateToken, deleteMessage);

export default router;
