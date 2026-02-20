import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';

import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';

import { globalErrorHandler } from './middleware/error.middleware';
import { notFoundHandler } from './middleware/notFound.middleware';
import { authenticateToken } from './middleware/auth.middleware';

import { authLimiter, apiLimiter } from './middleware/rate-limit.middleware';
import { sendResponse } from './utils/response';
import { logger } from './utils/logger';


// Load environment variables first
dotenv.config();

// Force restart trigger


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
import clinicalCopilotRoutes from './routes/clinical-copilot.routes';
import commonRoutes from './routes/common.routes';
import fileRoutes from './routes/file.routes';


// --- Production Hardening: Fail-Fast Environment Check ---
const REQUIRED_ENV = ['JWT_SECRET', 'DB_PASSWORD', 'GEMINI_API_KEY'];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
    logger.error(`[FATAL] Missing critical environment variables: ${missingEnv.join(', ')}`);
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
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires', 'Accept', 'X-Requested-With', 'Origin'],
}));

// V2 FIX: Helmet Hardening (CSP Enabled)
app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'"], // Allow inline scripts for basic functionality if needed
            "style-src": ["'self'", "'unsafe-inline'"],
            "img-src": ["'self'", "data:", "blob:"],
            "connect-src": ["'self'", "ws:", "wss:"], // Allow WebSocket connections
        }
    },
}));

// V3 FIX: HTTP Request Logging via Morgan (Piped to Secure Logger)
// Uses 'combined' format for standard Apache-style logs
const morganFormat = IS_PRODUCTION ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
    stream: {
        write: (message) => logger.info(message.trim(), { type: 'http' })
    },
    skip: (req, res) => req.url === '/health' // Skip health checks to reduce noise
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ─── V5 FIX: Tiered rate limiters — demo-safe but production-hardened ────────
// Moved to src/middleware/rate-limit.middleware.ts to avoid circular dependencies

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

interface AuthSocket extends Socket {
    user?: any; // Replace 'any' with specific user interface if available globally
}

// Authenticate every socket connection with a valid JWT
io.use((socket: AuthSocket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
        return next(new Error('Authentication required'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
        socket.user = decoded;
        next();
    } catch {
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
app.use('/api/clinical-copilot', clinicalCopilotRoutes); // NEW: Clinical Copilot Secure Route
app.use('/api/common', commonRoutes);
app.use('/api/files', fileRoutes);


// Serve uploaded files
// V12 FIX: Protected static assets.
// Note: Requests for these files must now include authorization (e.g., via session cookie or token)
app.use('/uploads', authenticateToken, express.static('uploads'));



// Legacy root route
app.get('/', (req, res) => {
    res.send('Haemi Life Backend is running');
});

// Global 404 Handler
app.use(notFoundHandler);

// Global Error Handler
app.use(globalErrorHandler);

// Socket.io Signaling Logic
io.on('connection', (socket: AuthSocket) => {
    const userId = socket.user?.id || socket.id;
    logger.info(`[Socket] User connected: ${userId}`);

    socket.on('join-consultation', (appointmentId) => {
        socket.join(appointmentId);
        socket.to(appointmentId).emit('participant-joined', socket.id);
    });

    socket.on('join_conversation', (conversationId) => {
        socket.join(conversationId);
    });

    socket.on('send_message', (message) => {
        // logger.debug(`[Socket] Message received for conversation: ${message?.conversationId}`); 
        // Commented out to reduce noise, enable if needed for debugging
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
        logger.info(`[Socket] User disconnected: ${userId}`);
    });
});

httpServer.listen(port, () => {
    logger.info(`[Server] Running on port ${port} (${process.env.NODE_ENV || 'development'})`);
    pool.query('SELECT NOW()', (err) => {
        if (err) {
            logger.error('[DB] Connection failed:', err.message);
        } else {
            logger.info('[DB] Connected successfully');
        }
    });
});
