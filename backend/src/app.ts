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
import consentRoutes from './routes/consent.routes';


// --- Production Hardening: Fail-Fast Environment Check ---
const REQUIRED_ENV = ['JWT_SECRET', 'DB_PASSWORD', 'GEMINI_API_KEY', 'ENCRYPTION_KEY'];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_DEMO_MODE = process.env.DEMO_MODE === 'true';

if (missingEnv.length > 0) {
    logger.error(`[FATAL] Missing critical environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
}

// ─── CRITICAL SECURITY GUARD: Prevent "Prod-Demo" accidental deployment ──────
if (IS_PRODUCTION && IS_DEMO_MODE) {
    logger.error(`[FATAL] SECURITY VIOLATION: NODE_ENV is 'production' but DEMO_MODE is active.`);
    logger.error(`[REASON] DEMO_MODE bypasses critical security rate-limiters and backdoors.`);
    process.exit(1);
}

const app = express();

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
app.get('/health', async (req, res) => {
    try {
        // Task 3: Execute real DB probe
        await pool.query('SELECT 1');
        sendResponse(res, 200, true, 'System Operational', {
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            db: 'connected'
        });
    } catch (error: any) {
        logger.error('[Health] DB probe failed:', error.message);
        sendResponse(res, 500, false, 'Database Disconnected', {
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            db: 'disconnected',
            error: error.message
        });
    }
});

// --- Task 1: Readiness Probe ---
app.get('/readiness', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).json({ status: "ready", db: "connected" });
    } catch (error: any) {
        logger.error('[Readiness] Fail:', error.message);
        res.status(500).json({ status: "not_ready", db: "disconnected" });
    }
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
app.use('/api/consents', consentRoutes);
app.use('/api/common', commonRoutes);
app.use('/api/files', fileRoutes);


// Serve uploaded files
// V12 FIX: Protected static assets.
// DEPRECATED: Direct static access for /uploads is disabled to prevent BOLA guesswork.
// All clinical files must now be routed through /api/files/ which enforces ownership.
// app.use('/uploads', authenticateToken, express.static('uploads'));



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

    // Join personal room for targeted notifications
    if (socket.user?.id) {
        socket.join(`user:${socket.user.id}`);
    }

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

// ─── Task 2: Safe Server Startup Check ──────────────────────────────
const startServer = async () => {
    try {
        // Test DB connection before listening
        await pool.query('SELECT 1');
        logger.info('[DB] Connection verified. Starting server...');

        const server = httpServer.listen(port, () => {
            logger.info(`[Server] Running on port ${port} (${process.env.NODE_ENV || 'development'})`);
        });

        // Task 2: Backend Request Timeout
        // Set a 15-second timeout for all HTTP requests to prevent resource exhaustion.
        server.timeout = 15000;

        return server;
    } catch (err: any) {
        logger.error('[Server] Fatal: DB connection failed during startup.');
        logger.error(`[Server] Error: ${err.message}`);
        process.exit(1);
    }
};

let server: any;
startServer().then(s => { server = s; });

// Task 2: Backend Request Timeout
// Set a 15-second timeout for all HTTP requests to prevent resource exhaustion.
server.timeout = 15000;

// ─── Task 2: Graceful Shutdown Implementation ──────────────────────────────
/**
 * Gracefully shuts down the server and database connections.
 * 1. Stops accepting new HTTP requests.
 * 2. Closes the PostgreSQL connection pool.
 * 3. Exits the process.
 */
const shutdown = (signal: string) => {
    logger.info(`[Server] ${signal} received. Starting graceful shutdown...`);

    server.close(async (err: any) => {
        if (err) {
            logger.error('[Server] Error during server close:', err);
            process.exit(1);
        }

        logger.info('[Server] HTTP server closed. No longer accepting requests.');

        try {
            await pool.end();
            logger.info('[DB] PostgreSQL pool closed.');
            process.exit(0);
        } catch (dbErr) {
            logger.error('[DB] Error closing PG pool:', dbErr);
            process.exit(1);
        }
    });

    // Enforce a hard timeout for shutdown (10s)
    setTimeout(() => {
        logger.error('[Server] Shutdown timed out. Forcing process exit.');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─── Task 6: Memory & Process Safety (DEMO SHIELD) ─────────────────────────
/**
 * Global handlers to prevent the demo server from crashing 
 * due to unhandled promise rejections or uncaught exceptions.
 */
process.on('unhandledRejection', (reason, promise) => {
    logger.error('[Process] Unhandled Rejection', { promise, reason });
    // In DEMO_SHIELD mode, we log but do NOT exit to keep the demo alive
    if (process.env.DEMO_SHIELD === 'true') {
        logger.warn('[DEMO SHIELD] Preserving process after unhandled rejection.');
    }
});

process.on('uncaughtException', (err) => {
    logger.error('[Process] Uncaught Exception:', err.message);
    logger.error(err.stack || 'No stack trace');

    if (process.env.DEMO_SHIELD === 'true') {
        logger.warn('[DEMO SHIELD] Preserving process after uncaught exception.');
    } else {
        // In non-demo mode, we exit as it's unsafe to continue
        process.exit(1);
    }
});

logger.info(`[DEMO SHIELD] Status: ${process.env.DEMO_SHIELD === 'true' ? 'ACTIVE' : 'INACTIVE'}`);
