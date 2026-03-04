import './config/env'; // Must be first to load environment variables before other imports
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { JWTPayload, AuthenticatedSocket } from './types/express';
import * as jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';

import { notFound } from './middleware/notFound.middleware';
import { errorHandler } from './middleware/error.middleware';
import { authLimiter, apiLimiter } from './middleware/rate-limit.middleware';
import { logger } from './utils/logger';
import { pool, checkConnection } from './config/db';
import { env } from './config/env';

// Routes
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
import profileRoutes from './routes/profile.routes';

const app = express();

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl) 
        // OR if origin is in our whitelist.
        if (!origin || env.allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error('CORS_NOT_ALLOWED'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    // Reflect requested headers in Access-Control-Allow-Headers.
    // This permanently solves the 'expires' or any custom header issue.
    allowedHeaders: undefined,
    optionsSuccessStatus: 204,
}));

app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: env.isProduction ? undefined : false,
}));

if (!env.isDemoMode) {
    app.use(morgan(env.isProduction ? 'combined' : 'dev', {
        stream: { write: (msg) => logger.info(msg.trim()) },
        skip: (req) => req.url === '/health'
    }));
}

app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

// Rate Limiting
if (!env.isDemoMode) {
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/signup', authLimiter);
    app.use('/api/', apiLimiter);
}

// Phase 6: DEMO_MODE Bypass (Auto-Auth)
if (env.isDemoMode) {
    app.use('/api', async (req: Request, _res: Response, next: NextFunction) => {
        const demoRole = req.headers['x-demo-role'];
        if (demoRole && !req.headers.authorization) {
            const role = (demoRole as string) || 'patient';
            (req as Request & { user: JWTPayload }).user = {
                id: 'demo-id',
                email: 'demo@haemi.life',
                role: role as 'patient' | 'doctor' | 'pharmacist' | 'admin',
                name: 'Demo User'
            };
            return next();
        }
        next();
    });
}

// DB Connection with Retry
// Removed redundant connectDB as startServer uses checkConnection

// Health Probes (Phase 3 Contract)
app.get('/health', async (_req, res) => {
    try {
        await checkConnection();
        res.status(200).json({
            server: "up",
            database: "connected",
            uptime: process.uptime(),
            version: process.env.npm_package_version || "1.0.0",
            timestamp: new Date().toISOString()
        });
    } catch {
        res.status(503).json({
            server: "up",
            database: "disconnected",
            uptime: process.uptime(),
            version: process.env.npm_package_version || "1.0.0",
            timestamp: new Date().toISOString()
        });
    }
});

// Readiness Probe for Orchestration (Phase 1 Contract)
app.get('/api/health/ready', async (_req, res) => {
    try {
        // 1. Check DB
        await pool.query('SELECT 1');
        // 2. Check Socket.IO (if initialized)
        const isSocketReady = !!io;

        if (isSocketReady) {
            return res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
        }
        res.status(503).json({ status: 'initializing', reason: 'socket_not_ready' });
    } catch {
        res.status(503).json({ status: 'not_ready', reason: 'db_connection_failed' });
    }
});

// Standard Response Headers
app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

// API Routes
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
app.use('/api/clinical-copilot', clinicalCopilotRoutes);
app.use('/api/consents', consentRoutes);
app.use('/api/common', commonRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/profiles', profileRoutes);

app.use(notFound);
app.use(errorHandler);

let io: Server | undefined;

// Server & Sockets
const startServer = async () => {
    try {
        logger.info('Starting boot sequence...');

        // Phase 3: Strict DB Verification
        await checkConnection();
        logger.info('✅ Database verified.');

        const server = createServer(app);
        io = new Server(server, {
            cors: { origin: "*", credentials: true }
        });

        // ... (Socket logic remains identical)
        setupSockets(io);

        const PORT = env.port;

        if (process.env.NODE_ENV !== 'test') {
            server.listen(PORT, () => {
                console.log('\n-------------------------------------------');
                console.log('🩺 HAEMI LIFE BACKEND STARTED');
                console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
                console.log(`Port:        ${PORT}`);
                console.log(`DB Status:   CONNECTED`);
                console.log(`Timestamp:   ${new Date().toLocaleString()}`);
                console.log('-------------------------------------------\n');
            });
        }
        return server;
    } catch (err: unknown) {
        const error = err as Error;
        console.error('\n-------------------------------------------');
        console.error('❌ FATAL: BACKEND BOOT FAILED');
        console.error(`Reason: ${error.message}`);
        console.error('-------------------------------------------\n');
        process.exit(1);
    }
};

// Extracted socket setup to keep startServer clean
function setupSockets(io: Server) {
    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Authentication required'));

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JWTPayload;

            // Database-level verification: Check token_version and status
            const userResult = await pool.query(
                'SELECT token_version, status FROM users WHERE id = $1',
                [decoded.id]
            );

            if (userResult.rows.length === 0) {
                return next(new Error('User not found'));
            }

            const user = userResult.rows[0];
            if (user.status !== 'ACTIVE') {
                return next(new Error('User account is inactive'));
            }

            if (decoded.token_version !== user.token_version) {
                return next(new Error('Session expired or revoked'));
            }

            (socket as AuthenticatedSocket).user = decoded;
            next();
        } catch (err) {
            logger.error('Socket authentication failed', { error: err });
            next(new Error('Invalid authentication token'));
        }
    });

    io.on('connection', (socket: import('socket.io').Socket) => {
        const authSocket = socket as AuthenticatedSocket;
        if (!authSocket.user) {
            logger.error('Socket connected without user data');
            return socket.disconnect();
        }
        const userId = authSocket.user.id;
        socket.join(`user:${userId}`);
        logger.info(`Socket: ${socket.id} user:${userId}`);

        // Chat events — canonical protocol: room = conversation:{id}, join = join_conversation
        socket.on('join_conversation', (conversationId: string) => socket.join(`conversation:${conversationId}`));
        socket.on('mark_read', (data: { conversationId: string; user_id: string }) => {
            if (io) io.to(`conversation:${data.conversationId}`).emit('messages_read', data);
        });
        socket.on('typing', (data: { conversationId: string; name: string }) => {
            socket.to(`conversation:${data.conversationId}`).emit('user_typing', data);
        });

        // WebRTC hooks
        socket.on('call-user', (data: { to: string; offer: JWTPayload }) => {
            if (io) io.to(data.to).emit('call-made', { offer: data.offer, socket: socket.id });
        });
        socket.on('make-answer', (data: { to: string; answer: JWTPayload }) => {
            if (io) io.to(data.to).emit('answer-made', { answer: data.answer, socket: socket.id });
        });
        socket.on('ice-candidate', (data: { to: string; candidate: JWTPayload }) => {
            if (io) io.to(data.to).emit('ice-candidate', { candidate: data.candidate, socket: socket.id });
        });

        socket.on('disconnect', () => logger.info(`Socket disconnected: ${socket.id}`));
    });
}

if (process.env.NODE_ENV !== 'test') startServer();

export { app, startServer, io };

// Graceful Shutdown
const shutdown = () => {
    logger.info('Shutting down...');
    pool.end().then(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    const errorReason = reason as Error;
    logger.error('Unhandled Rejection at:', {
        promise,
        reason: errorReason?.message || reason,
        stack: errorReason?.stack
    });
});

process.on('uncaughtException', (err: Error) => {
    logger.error('Uncaught Exception thrown:', {
        message: err.message,
        stack: err.stack
    });
    // Institutional Hardening: Graceful exit on uncaught exception
    shutdown();
});
