import './config/env'; // Must be first to load environment variables before other imports
import express from 'express';

import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { JWTPayload } from './types/express';
import { 
    ServerToClientEvents, 
    ClientToServerEvents, 
    InterServerEvents, 
    SocketData, 
    StrictAuthenticatedSocket 
} from './types/socket.types';
import * as jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';

import { notFound } from './middleware/not-found.middleware';
import { errorHandler } from './middleware/error.middleware';
import { authLimiter, apiLimiter } from './middleware/rate-limit.middleware';
import { logger } from './utils/logger';
import { pool, checkConnection } from './config/db';
import { chatReliabilityService } from './services/chat-reliability.service';
import { env } from './config/env';
import { schemaIntegrityService } from './services/schema-integrity.service';
import { corsMiddleware } from './middleware/cors.middleware';
import * as guards from './utils/guards/socket.guards';

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

app.use(corsMiddleware);

// Global CORS handles all methods including OPTIONS before any auth logic

app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
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
if (!env.isDemoMode && process.env.NODE_ENV !== 'test') {
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/signup', authLimiter);
    app.use('/api/', apiLimiter);
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
        const isSocketReady = !!socketIO;

        if (isSocketReady) {
            return res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
        }
        res.status(503).json({ status: 'initializing', reason: 'socket_not_ready' });
    } catch {
        res.status(503).json({ status: 'not_ready', reason: 'db_connection_failed' });
    }
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

export let socketIO: Server<ClientToServerEvents, ServerToClientEvents> | undefined;

// Server & Sockets
const startServer = async () => {
    try {
        logger.info('Starting boot sequence...');

        // Phase 3: Strict DB Verification
        await checkConnection();
        await schemaIntegrityService.validate();
        logger.info('✅ Database and Schema Integrity verified.');

        const server = createServer(app);
        socketIO = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
            cors: {
                origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
                    const allowed = env.allowedOrigins && env.allowedOrigins.length > 0 ? env.allowedOrigins : ["http://localhost:5173"];
                    if (!origin || allowed.includes(origin)) {
                        callback(null, true);
                    } else {
                        callback(new Error(JSON.stringify({
                            code: "SERVER_REJECTED",
                            message: "Origin not allowed"
                        })));
                    }
                },
                credentials: true
            }
        });

        // ... (Socket logic remains identical)
        setupSockets(socketIO);

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
        const errorMessage = err instanceof Error ? err.message : 'Unknown fatal error';
        console.error('\n-------------------------------------------');
        console.error('❌ FATAL: BACKEND BOOT FAILED');
        console.error(`Reason: ${errorMessage}`);
        console.error('-------------------------------------------\n');
        process.exit(1);
    }
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isAuthenticatedSocket(socket: Socket): socket is StrictAuthenticatedSocket {
    return guards.isAuthenticatedSocketData(socket.data);
}

// Extracted socket setup to keep startServer clean
function setupSockets(io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
    io.use(async (socket: Socket, next: (err?: Error) => void) => {
        const auth = socket.handshake.auth;
        const token = typeof auth === 'object' && auth !== null && 'token' in auth && typeof auth.token === 'string' ? auth.token : null;

        if (!token) {
            return next(new Error(JSON.stringify({ code: 'AUTH_INVALID', message: 'Authentication required' })));
        }

        try {
            const secret = process.env.JWT_SECRET;
            if (typeof secret !== 'string') {
                logger.error('JWT_SECRET is not a string', { secretType: typeof secret });
                return next(new Error(JSON.stringify({ code: 'SERVER_REJECTED', message: 'Internal server error' })));
            }

            const decodedPayload: unknown = jwt.verify(token, secret);

            if (typeof decodedPayload !== 'object' || decodedPayload === null || !('id' in decodedPayload) || !('role' in decodedPayload) || !('token_version' in decodedPayload) || !('email' in decodedPayload) || !('name' in decodedPayload)) {
                return next(new Error(JSON.stringify({ code: 'AUTH_INVALID', message: 'Invalid token payload' })));
            }

            if (!isRecord(decodedPayload)) {
                return next(new Error(JSON.stringify({ code: 'AUTH_INVALID', message: 'Invalid token payload' })));
            }

            const role = decodedPayload.role;
            if (role !== 'patient' && role !== 'doctor' && role !== 'pharmacist') {
                return next(new Error(JSON.stringify({ code: 'AUTH_INVALID', message: 'Invalid role' })));
            }

            const decoded: JWTPayload = {
                id: String(decodedPayload.id),
                email: String(decodedPayload.email),
                role: role,
                name: String(decodedPayload.name),
                token_version: Number(decodedPayload.token_version)
            };

            // Database-level verification: Check token_version and status
            const userResult = await pool.query(
                'SELECT token_version, status FROM users WHERE id = $1',
                [decoded.id]
            );

            if (userResult.rowCount === 0) {
                return next(new Error(JSON.stringify({ code: 'AUTH_INVALID', message: 'User not found' })));
            }

            const user = userResult.rows[0];
            if (typeof user !== 'object' || user === null || !('status' in user) || !('token_version' in user)) {
                return next(new Error(JSON.stringify({ code: 'SERVER_REJECTED', message: 'Database integrity error' })));
            }

            if (user.status !== 'ACTIVE') {
                return next(new Error(JSON.stringify({ code: 'SERVER_REJECTED', message: 'User account is inactive' })));
            }

            if (decoded.token_version !== user.token_version) {
                return next(new Error(JSON.stringify({ code: 'AUTH_EXPIRED', message: 'Session expired or revoked' })));
            }

            // Explicitly extending socket with user data
            socket.data.user = decoded;
            next();
        } catch (err) {
            logger.error('Socket authentication failed', { error: err });
            next(new Error(JSON.stringify({ code: 'AUTH_INVALID', message: 'Invalid authentication token' })));
        }
    });

    io.on('connection', (socket: Socket) => {
        if (!isAuthenticatedSocket(socket)) {
            logger.error('Socket connected without user data');
            return socket.disconnect();
        }

        const user = socket.data.user;
        if (!user) {
            logger.error('Socket connected but user data is missing from socket.data');
            return socket.disconnect();
        }
        const userId = user.id;
        socket.join(`user:${userId}`);
        logger.info(`Socket: ${socket.id} user:${userId}`);

        // ENTERPRISE HARDENING: Standardized Event Listeners
        socket.on('join_conversation', (conversationId: unknown) => {
            if (!guards.isJoinConversationPayload(conversationId)) return;
            socket.join(`conversation:${conversationId}`);
        });

        socket.on('ack_read', async (data: unknown) => {
            if (!guards.isAckReadPayload(data)) return;
            
            if (io) {
                const participantIds = await chatReliabilityService.getParticipants(data.conversationId);

                // Optimized: Only the original sender(s) in the conversation should receive message_read updates.
                participantIds.filter((pid: string) => pid !== data.user_id).forEach((pid: string) => {
                    io?.to(`user:${pid}`).emit('message_read', data);
                });
            }
        });

        // Ephemeral Typing Stream (Lightweight)
        socket.on('typing_started', (data: unknown) => {
            if (!guards.isTypingPayload(data)) return;
            socket.to(`conversation:${data.conversationId}`).emit('typing_started', data);
        });

        socket.on('typing_stopped', (data: unknown) => {
            if (!guards.isTypingPayload(data)) return;
            socket.to(`conversation:${data.conversationId}`).emit('typing_stopped', data);
        });

        // WebRTC hooks
        socket.on('call-user', (data: unknown) => {
            if (!guards.isSignalPayload(data)) return;
            if (io) io.to(data.to).emit('call-made', { offer: data.offer, socket: socket.id });
        });

        socket.on('make-answer', (data: unknown) => {
            if (!guards.isAnswerPayload(data)) return;
            if (io) io.to(data.to).emit('answer-made', { answer: data.answer, socket: socket.id });
        });

        socket.on('ice-candidate', (data: unknown) => {
            if (!guards.isIcePayload(data)) return;
            if (socketIO) socketIO.to(data.to).emit('ice-candidate', { candidate: data.candidate, socket: socket.id });
        });

        socket.on('ack_delivery', (data: unknown) => {
            if (!guards.isAckDeliveryPayload(data)) return; // STRICT REJECTION via guard
            socket.to(`conversation:${data.conversationId}`).emit('ack_delivery', data);
        });

        socket.on('disconnect', () => logger.info(`Socket disconnected: ${socket.id}`));
    });
}

if (process.env.NODE_ENV !== 'test') startServer();

export { app, startServer };

// Graceful Shutdown
const shutdown = () => {
    logger.info('Shutting down...');
    pool.end().then(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    const errorMsg = reason instanceof Error ? reason.message : String(reason);
    const errorStack = reason instanceof Error ? reason.stack : undefined;
    logger.error('Unhandled Rejection at:', {
        promise,
        reason: errorMsg,
        stack: errorStack
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
