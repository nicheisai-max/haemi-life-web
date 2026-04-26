import './config/env'; // Must be first to load environment variables (DIAGNOSTIC_REVEAL_ACTIVE: 2026-04-04T11:47)
import express from 'express';

import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Socket } from 'socket.io';
import { JWTPayload } from './types/express';
import {
    ServerToClientEvents,
    ClientToServerEvents,
    InterServerEvents,
    SocketData,
    StrictAuthenticatedSocket
} from './types/socket.types';
import { UserId, ConversationId } from './types/chat.types';
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
import { cleanupService } from './services/cleanup.service';
import { StorageBootstrapper } from './services/storage-bootstrapper.service';
import { corsMiddleware } from './middleware/cors.middleware';
import { statusService } from './services/status.service';
import { isJWTPayload } from './utils/type-guards';

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
import aiRoutes from './routes/ai.routes';
import pharmacistRoutes from './routes/pharmacist.routes';
import screeningRoutes from './routes/screening.routes';

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
    app.use('/api/', (req, res, next) => {
        if (req.path.startsWith('/health')) return next();
        return apiLimiter(req, res, next);
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
    } catch (error: unknown) {
        logger.error('[HealthProbe] Liveness check failure', { 
            error: error instanceof Error ? error.message : String(error) 
        });
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
    } catch (error: unknown) {
        logger.error('[HealthProbe] Readiness check failure', { 
            error: error instanceof Error ? error.message : String(error) 
        });
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
app.use('/api/ai', aiRoutes);
app.use('/api/pharmacist', pharmacistRoutes);
app.use('/api/screening', screeningRoutes);

app.use(notFound);
app.use(errorHandler);

import { Server as SocketIOServer } from 'socket.io';
import { HaemiServer } from './types/socket.types';

export let socketIO: HaemiServer | undefined;

// Server & Sockets
const startServer = async () => {
    try {
        logger.info('Starting boot sequence...');

        // Phase 3: Strict DB Verification
        await checkConnection();
        await schemaIntegrityService.validate();
        await StorageBootstrapper.initialize(); // Ensure physical assets
        cleanupService.initialize(); // Institutional Cleanup Guardian (v5.1)
        logger.info('✅ Database, Schema, and Cleanup Guardian verified.');

        const server = createServer(app);
        socketIO = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(server, {
            cors: {
                origin: env.allowedOrigins,
                credentials: true,
                methods: ["GET", "POST", "OPTIONS"],
                allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
            },
            transports: ["websocket"], // P0: Google/Meta Grade Direct WebSocket (Zero-Handshake Loop)
            allowEIO3: false,
            pingTimeout: 60000,
            pingInterval: 25000
        });

        // ... (Socket logic remains identical)
        setupSockets(socketIO);

        const PORT = env.port;

        if (process.env.NODE_ENV !== 'test') {
            server.listen(PORT, () => {
                logger.info('-------------------------------------------');
                logger.info('🩺 HAEMI LIFE BACKEND ENGINE | Ready');
                logger.info('   -> PHASE 7: FINAL STABILITY VERIFIED');
                logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
                logger.info(`Port:        ${PORT}`);
                logger.info('-------------------------------------------\n');
            });
        }
        return server;
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown fatal error';
        logger.error('-------------------------------------------');
        logger.error('❌ FATAL: BACKEND BOOT FAILED');
        logger.error(`Reason: ${errorMessage}`);
        logger.error('-------------------------------------------');
        process.exit(1);
    }
};



// Extracted socket setup to keep startServer clean
function setupSockets(io: HaemiServer) {
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
            // Fix 4: Log socket.id only — never log token content (not even a prefix)
            logger.info(`[Socket:Handshake] Auth success for socket: ${socket.id}`);

            // P0 PRESENCE FIX: Use centralized type guard to ensure all required fields (id, email, role, tokenVersion, jti, sessionId)
            if (!isJWTPayload(decodedPayload)) {
                return next(new Error(JSON.stringify({ code: 'AUTH_INVALID', message: 'Invalid token payload or missing required fields' })));
            }

            const decoded = decodedPayload as JWTPayload;

            if (!decoded.email || !decoded.id || !decoded.sessionId) {
                return next(new Error(JSON.stringify({ 
                    code: 'AUTH_INVALID', 
                    message: 'Malformed token payload' 
                })));
            }

            // Fallback initialization for name (populated from DB below)
            decoded.name = '';

            // Database-level verification: Check tokenVersion, status, AND fetch name
            const userResult = await pool.query(
                'SELECT token_version, status, name FROM users WHERE id = $1',
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

            if (decoded.tokenVersion !== user.token_version) {
                return next(new Error(JSON.stringify({ code: 'AUTH_EXPIRED', message: 'Session expired or revoked' })));
            }

            // P0 PRESENCE FIX: Populate name from DB (not in JWT)
            decoded.name = String(user.name || '');

            // Explicitly extending socket with user data
            socket.data.user = decoded;
            next();
        } catch (err: unknown) {
            logger.error('Socket authentication failed', { 
                error: err instanceof Error ? err.message : String(err) 
            });
            next(new Error(JSON.stringify({ code: 'AUTH_INVALID', message: 'Invalid authentication token' })));
        }
    });

    // Phase 10: Institutional Reset (Socket-Specific Cleanup)
    // Synchronize Database with Server RAM state on startup WITHOUT TRUNCATE
    statusService.institutionalSocketCleanup();
    
    io.on('connection', async (socket: StrictAuthenticatedSocket) => {
        // P0 PRESENCE FIX: Read user from socket.data (set by auth middleware)
        const user = socket.data?.user;
        if (!user || !user.id) {
            const errMsg = `[PRESENCE FAILURE] Socket ${socket.id} connected but socket.data.user is missing or has no id. data=${JSON.stringify(socket.data)}`;
            logger.error(errMsg);
            socket.disconnect(true);
            return;
        }

        const userId = String(user.id) as UserId;
        socket.join(`user:${userId}`);

        // Admin Observability Auto-Join
        if (user.role === 'admin') {
            socket.join('admin:observability');
        }

        logger.info(`[PRESENCE] Socket ${socket.id} connected for userId=${userId} role=${user.role}`);
        logger.info(`Socket: ${socket.id} user:${userId}`);

        // 1. HEARTBEAT (Meta-Grade Sync)
        // P0: Zero-hallucination activity tracking.
        socket.on('heartbeat', async () => {
             await statusService.updateHeartbeat(userId, socket.id);
        });

        // 1.5. TARGETED Presence (Deterministic Async)
        try {
            const presence = await statusService.setUserOnline(userId, socket.id);
            const partnerIds = await chatReliabilityService.getConversationPartners(userId);

            // Emit to partner rooms ONLY if socket is still active
            partnerIds.forEach(pid => {
                if (socket.connected) {
                    io.to(`user:${pid}`).emit('userStatus', presence);
                }
            });

            // Always emit to admin observability (The Governor)
            io.to('admin:observability').emit('adminMirrorEvent', {
                event: 'userStatus',
                data: presence,
                timestamp: new Date().toISOString()
            });
        } catch (error: unknown) {
            logger.error(`Presence online sync failed for ${userId}:`, { 
                error: error instanceof Error ? error.message : String(error) 
            });
        }

        // 2. JOIN: Standard Conversational Stream
        socket.on('joinConversation', (conversationId: string) => {
            socket.join(`conversation:${conversationId}`);
        });

        // 3. READ RECEIPTS (Nuclear Standardization)
        // P0: PURGED 'ackRead' and 'messageRead' to prevent event duplication.
        // All receipts MUST use 'messageRead'.
        socket.on('messageRead', (data: import('./types/socket.types').MessageReadEvent) => {
            const { conversationId } = data;
            if (conversationId) {
                // P0 NUCLEAR: Single Channel Emission
                // Data is delivered EXCLUSIVELY to the conversation room.
                io.to(`conversation:${conversationId}`).emit('messageRead', data);

                // The Governor Mirroring
                io.to('admin:observability').emit('adminMirrorEvent', {
                    event: 'messageRead',
                    data,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // 4. EPHEMERAL STREAMS (Typing/Signaling)
        socket.on('typingStarted', (data) => {
            const payload = {
                userId: userId,
                conversationId: data.conversationId as ConversationId,
                name: user.name || 'Someone'
            };
            socket.to(`conversation:${data.conversationId}`).emit('typingStarted', payload);
            
            // The Governor Mirroring
            io.to('admin:observability').emit('adminMirrorEvent', {
                event: 'typingStarted',
                data: payload,
                timestamp: new Date().toISOString()
            });
        });

        socket.on('typingStopped', (data) => {
            const payload = {
                userId: userId,
                conversationId: data.conversationId as ConversationId,
                name: user.name || 'Someone'
            };
            socket.to(`conversation:${data.conversationId}`).emit('typingStopped', payload);

            // The Governor Mirroring
            io.to('admin:observability').emit('adminMirrorEvent', {
                event: 'typingStopped',
                data: payload,
                timestamp: new Date().toISOString()
            });
        });

        // WebRTC hooks
        socket.on('callUser', (data) => {
            io.to(data.to).emit('callMade', { offer: data.offer, socket: socket.id });
        });

        socket.on('makeAnswer', (data) => {
            io.to(data.to).emit('answerMade', { answer: data.answer, socket: socket.id });
        });

        socket.on('iceCandidate', (data) => {
            io.to(data.to).emit('iceCandidate', { candidate: data.candidate, socket: socket.id });
        });

        socket.on('ackDelivery', (data) => {
            socket.to(`conversation:${data.conversationId}`).emit('ackDelivery', data);
        });

        socket.on('disconnect', () => {
            logger.info(`[PRESENCE] Socket disconnected: ${socket.id} for user ${userId}`);
            statusService.setUserOffline(userId, socket.id).then(async (presence) => {
                if (!presence.isOnline) {
                    // Find all unique partners across all conversations
                    const partnerIds = await chatReliabilityService.getConversationPartners(userId);

                    // Emit status change only to relevant users
                    partnerIds.forEach(pid => {
                        io.to(`user:${pid}`).emit('userStatus', presence);
                    });

                    // Always emit to admin observability (The Governor)
                    io.to('admin:observability').emit('adminMirrorEvent', {
                        event: 'userStatus',
                        data: presence,
                        timestamp: new Date().toISOString()
                    });
                }
            }).catch((error: unknown) => {
                logger.error(`[PRESENCE FAILURE] Offline sync failed for ${userId}:`, { 
                    error: error instanceof Error ? error.message : String(error) 
                });
            });
        });
    });
}

if (process.env.NODE_ENV !== 'test') startServer();

export { app, startServer };

// Graceful Shutdown
const shutdown = () => {
    logger.info('Initiating graceful shutdown...');
    pool.end()
        .then(() => {
            logger.info('✅ Database pool closed.');
            process.exit(0);
        })
        .catch((err: unknown) => {
            logger.error('❌ Error during database pool shutdown', { 
                error: err instanceof Error ? err.message : String(err) 
            });
            process.exit(1);
        });
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
