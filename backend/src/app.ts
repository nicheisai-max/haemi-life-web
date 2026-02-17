import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { globalErrorHandler } from './middleware/error.middleware';
import { notFoundHandler } from './middleware/notFound.middleware';
import { sendResponse } from './utils/response';

// Load environment variables first
dotenv.config();

import { pool } from './config/db';
import authRoutes from './routes/auth.routes';
import doctorRoutes from './routes/doctor.routes';
import appointmentRoutes from './routes/appointment.routes';
import prescriptionRoutes from './routes/prescription.routes';
import chatRoutes from './routes/chat.routes';
import notificationRoutes from './routes/notification.routes';
import recordRoutes from './routes/record.routes';
import adminRoutes from './routes/admin.routes';
import analyticsRoutes from './routes/analytics.routes';
import passwordResetRoutes from './routes/password-reset.routes';
import commonRoutes from './routes/common.routes';

// --- Production Hardening: Fail-Fast Environment Check ---
const REQUIRED_ENV = ['JWT_SECRET', 'DB_PASSWORD'];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
    console.error(`[FATAL] Missing critical environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
}

const app = express();

// --- Phase 10: Production Security ---
app.use(helmet());
app.use(cors()); // Configure origin in production
app.use(express.json({ limit: '10mb' })); // Phase 10: Request size limit

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Increased for development - adjust lower in production
    message: {
        success: false,
        error: 'Too many requests, please try again later.',
        statusCode: 429
    }
});
app.use('/api/', limiter);

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});
const port = process.env.PORT || 5000;

export { io };

// --- Phase 12: Health Check ---
app.get('/health', (req, res) => {
    sendResponse(res, 200, true, 'System Operational', {
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/common', commonRoutes);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Basic health check route (Legacy)
app.get('/', (req, res) => {
    res.send('Haemi Life Backend + Signaling Server is running');
});

// --- Phase 2: Global 404 Handler ---
app.use(notFoundHandler);

// --- Phase 6: Global Error Handler ---
app.use(globalErrorHandler);

// Socket.io Signaling Logic
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-consultation', (appointmentId) => {
        socket.join(appointmentId);
        console.log(`User ${socket.id} joined consultation room: ${appointmentId}`);
        socket.to(appointmentId).emit('participant-joined', socket.id);
    });

    // Chat System Events
    socket.on('join_conversation', (conversationId) => {
        socket.join(conversationId);
        console.log(`User ${socket.id} joined chat room: ${conversationId}`);
    });

    socket.on('send_message', (message) => {
        // Broadcast to everyone in the room EXCEPT sender (sender adds optimistically or via API response)
        // Actually, for consistency, we might just broadcast to room.
        // But our controller already emits 'receive_message', so we might not need this if API drive.
        // If we want purely socket driven:
        // socket.to(message.conversationId).emit('receive_message', message);
        console.log('Socket received message:', message);
    });

    socket.on('typing', ({ conversationId, userId, isTyping }) => {
        socket.to(conversationId).emit('user_typing', { userId, isTyping });
    });

    socket.on('call-user', ({ offer, to }) => {
        socket.to(to).emit('call-made', { offer, socket: socket.id });
    });

    socket.on('make-answer', ({ answer, to }) => {
        socket.to(to).emit('answer-made', { answer, socket: socket.id });
    });

    socket.on('ice-candidate', ({ candidate, to }) => {
        socket.to(to).emit('ice-candidate', { candidate, socket: socket.id });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

httpServer.listen(port, () => {
    console.log(`Server (with signaling) is running on port ${port}`);
    // Test DB connection
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error('Error connecting to database', err);
        } else {
            console.log('Database connected successfully');
        }
    });
});
