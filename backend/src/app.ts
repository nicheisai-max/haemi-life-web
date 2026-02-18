import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

import { globalErrorHandler } from './middleware/error.middleware';
import { notFoundHandler } from './middleware/notFound.middleware';
import { authenticateToken } from './middleware/auth.middleware'; // V12 requirement
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
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ─── V1 FIX: CORS — env-based allowlist, dev wildcard fallback ───────────────
// In production: set ALLOWED_ORIGINS=https://app.haemilife.com,https://haemilife.com
// In dev/demo: all origins allowed (no bottleneck for investor demo)
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : null;

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, server-to-server)
        if (!origin) return callback(null, true);
        // In dev/demo mode (no ALLOWED_ORIGINS set), allow everything
        if (!allowedOrigins) return callback(null, true);
        // In production, enforce allowlist
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: Origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires'],
}));

app.use(helmet());
app.use(express.json({ limit: '10mb' }));

// ─── V5 FIX: Tiered rate limiters — demo-safe but production-hardened ────────
// Auth endpoints: 50 req/15min per IP (generous for demo, blocks brute force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: IS_PRODUCTION ? 20 : 50,
    message: { success: false, error: 'Too many auth attempts. Please try again in 15 minutes.', statusCode: 429 },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !IS_PRODUCTION && process.env.VITE_DEMO_MODE === 'true', // Skip in demo mode
});

// General API: 300 req/15min (ample for investor demo)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: IS_PRODUCTION ? 200 : 300,
    message: { success: false, error: 'Too many requests. Please try again later.', statusCode: 429 },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply auth limiter to login/signup/password-reset only
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/password-reset', authLimiter);

// Apply general limiter to all other API routes
app.use('/api/', apiLimiter);

const httpServer = createServer(app);

// ─── V10 FIX: Socket.io — JWT authentication middleware ──────────────────────
const io = new Server(httpServer, {
    cors: {
        // Socket.io CORS follows the same policy as the HTTP server
        origin: allowedOrigins ?? '*',
        methods: ['GET', 'POST'],
        credentials: true,
    }
});

// Authenticate every socket connection with a valid JWT
io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
        // In demo/dev mode, allow unauthenticated sockets for easier testing
        if (!IS_PRODUCTION) return next();
        return next(new Error('Authentication required'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
        (socket as any).user = decoded;
        next();
    } catch {
        // In demo/dev mode, allow even if token is invalid
        if (!IS_PRODUCTION) return next();
        next(new Error('Invalid authentication token'));
    }
});

const port = process.env.PORT || 5000;

export { io };

// --- Health Check ---
app.get('/health', (req, res) => {
    sendResponse(res, 200, true, 'System Operational', {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
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
// NOTE: V12 (Auth-gating) is deferred to production deployment (signed URLs/Cookies)
// to prevent breaking standard <img> tags during the investor demo.
app.use('/uploads', express.static('uploads'));



// Legacy root route
app.get('/', (req, res) => {
    res.send('Haemi Life Backend is running');
});

// Global 404 Handler
app.use(notFoundHandler);

// Global Error Handler
app.use(globalErrorHandler);

// Socket.io Signaling Logic
io.on('connection', (socket: Socket) => {
    const userId = (socket as any).user?.id || socket.id;
    console.log(`[Socket] User connected: ${userId}`);

    socket.on('join-consultation', (appointmentId) => {
        socket.join(appointmentId);
        socket.to(appointmentId).emit('participant-joined', socket.id);
    });

    socket.on('join_conversation', (conversationId) => {
        socket.join(conversationId);
    });

    socket.on('send_message', (message) => {
        console.log('[Socket] Message received:', message?.conversationId);
    });

    socket.on('typing', ({ conversationId, userId: typingUserId, isTyping }) => {
        socket.to(conversationId).emit('user_typing', { userId: typingUserId, isTyping });
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
        console.log(`[Socket] User disconnected: ${userId}`);
    });
});

httpServer.listen(port, () => {
    console.log(`[Server] Running on port ${port} (${process.env.NODE_ENV || 'development'})`);
    pool.query('SELECT NOW()', (err) => {
        if (err) {
            console.error('[DB] Connection failed:', err.message);
        } else {
            console.log('[DB] Connected successfully');
        }
    });
});
