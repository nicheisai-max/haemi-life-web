import { pool } from '../../config/db';
import { Request, Response, NextFunction } from 'express';

const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
};

// 🩺 Institutional Global Mocks (Zero-Side-Effect)
jest.mock('../../config/db', () => ({
    pool: {
        query: jest.fn(),
        connect: jest.fn(() => Promise.resolve(mockClient)),
        end: jest.fn(),
    }
}));

// 🪓 CORS Bypass: Preventing 204 No Content for OPTIONS (The CI Ghost)
// FIX: No 'any' - using official Express types
jest.mock('../../middleware/cors.middleware', () => ({
    corsMiddleware: (_req: Request, _res: Response, next: NextFunction) => next()
}));

jest.mock('../../services/status.service', () => ({
    statusService: {
        purgeUserConnections: jest.fn().mockResolvedValue({ userId: '...', status: 'offline' }),
        setUserOnline: jest.fn().mockResolvedValue({}),
        setUserOffline: jest.fn().mockResolvedValue({}),
        isOnline: jest.fn().mockResolvedValue(false),
    }
}));

jest.mock('../../services/observability.service', () => ({
    observabilityService: {
        logSessionEnd: jest.fn(),
        logLogin: jest.fn(),
        logSessionStart: jest.fn(),
        logTokenRefresh: jest.fn(),
    }
}));

import request from 'supertest';
import { app } from '../../app';
import * as jwt from 'jsonwebtoken';

describe('Session Isolation (Phase 2)', () => {
    // 🩺 Precision UUIDs (Zod & Postgres Validated)
    const userId = '00000000-0000-0000-0000-000000000001';
    const sessionId = 'de305d54-75b4-431b-adb2-eb6b9e546013';
    const jti = '00000000-0000-0000-0000-000000000003';
    const jwtSecret = process.env.JWT_SECRET || 'HAEMI_LIFE_INTEGRITY_FAILSAFE';

    interface UserMock {
        id: string;
        email: string;
        name: string;
        role: string;
        status: string;
        token_version: number;
        lastActivity: Date;
        minutes_since_activity: number;
    }

    interface SessionMock {
        session_id: string;
        user_id: string;
        refresh_token_jti: string;
        revoked: boolean;
    }

    // Data-Driven Mock State (Institutional Grade)
    let mockState: {
        user: UserMock | null;
        session: SessionMock | null;
    } = {
        user: null,
        session: null
    };

    beforeAll(() => {
        process.env.JWT_SECRET = jwtSecret;
        // Silence console out during tests
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
        jest.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset Mock State with valid UUIDs
        mockState = {
            user: {
                id: userId,
                email: 'test@haemilife.com',
                name: 'Test User',
                role: 'patient',
                status: 'ACTIVE',
                token_version: 1,
                lastActivity: new Date(),
                minutes_since_activity: 5
            },
            session: {
                session_id: sessionId,
                user_id: userId,
                refresh_token_jti: jti,
                revoked: false
            }
        };

        /**
         * 🛡️ ZERO-ANY Mock Implementation
         * Institutional Grade - Type-Safe Data Driven architecture
         */
        const dbMock = async (sql: string | { text: string; values?: unknown[] }, _params?: unknown[]) => {
            const queryRaw = typeof sql === 'string' ? sql : sql.text;
            const normalizedQuery = queryRaw.toLowerCase();
            
            // 1. System Settings (Middleware)
            if (normalizedQuery.includes('system_settings')) {
                if (normalizedQuery.includes('session_timeout_minutes')) return { rows: [{ value: '60' }] };
                if (normalizedQuery.includes('jwt_access_expiry_minutes')) return { rows: [{ value: '15' }] };
                if (normalizedQuery.includes('jwt_refresh_expiry_days')) return { rows: [{ value: '7' }] };
                return { rows: [] };
            }

            // 2. User Lookups (Call-Order Independent)
            if (normalizedQuery.includes('select') && normalizedQuery.includes('from users')) {
                return { rows: mockState.user ? [mockState.user] : [] };
            }

            // 3. Session Lookups (Call-Order Independent)
            if (normalizedQuery.includes('select') && normalizedQuery.includes('from user_sessions')) {
                return { rows: mockState.session ? [mockState.session] : [] };
            }

            // 4. State-Reactive Updates (Data-Driven Architecture)
            if (normalizedQuery.includes('update')) {
                // Increment token_version on users table
                if (normalizedQuery.includes('users') && (normalizedQuery.includes('token_version') || normalizedQuery.includes('coalesce'))) {
                    if (mockState.user) mockState.user.token_version += 1;
                }
                // Mark session as revoked on user_sessions table
                if (normalizedQuery.includes('user_sessions') && normalizedQuery.includes('revoked = true')) {
                    if (mockState.session) mockState.session.revoked = true;
                }
                return { rows: [] };
            }

            // 5. Transaction Commands
            if (['begin', 'commit', 'rollback'].includes(normalizedQuery.trim().split(' ')[0])) {
                return { rows: [] };
            }

            // 6. Generic DELETE (Status Services)
            if (normalizedQuery.includes('delete')) {
                return { rows: [] };
            }

            // Default fallback
            return { rows: [] };
        };

        (pool.query as jest.Mock).mockImplementation(dbMock);
        (mockClient.query as jest.Mock).mockImplementation(dbMock);
    });

    describe('Cookie Security & Revocation', () => {

        it('should reject refresh token with mismatched token_version', async () => {
            // 1. Create a "stale" refresh token (version 0)
            const staleToken = jwt.sign(
                { id: userId, tokenVersion: 0, sessionId: sessionId, jti: jti, email: 'test@haemilife.com', role: 'patient' },
                jwtSecret,
                { expiresIn: '7d' }
            );

            // 2. Mock state has version 1
            mockState.user!.token_version = 1;

            // 3. Attempt to refresh
            const res = await request(app)
                .post('/api/auth/refresh-token')
                .send({ refreshToken: staleToken });

            // 4. Verify rejection
            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/Session revoked due to security violation/i);
        });

        it('should accept refresh token with matching token_version', async () => {
            // 1. Create a "valid" refresh token (version 1)
            const validToken = jwt.sign(
                { id: userId, tokenVersion: 1, sessionId: sessionId, jti: jti, email: 'test@haemilife.com', role: 'patient' },
                jwtSecret,
                { expiresIn: '7d' }
            );

            // 2. Mock state matches
            mockState.user!.token_version = 1;

            // 4. Attempt to refresh
            const res = await request(app)
                .post('/api/auth/refresh-token')
                .send({ refreshToken: validToken });

            // 5. Verify success
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('Logout Revocation', () => {
        it('should increment token_version on logout', async () => {
            // Mock token for auth middleware (Must be compliant with JwtPayloadStrict)
            const token = jwt.sign(
                { 
                    id: userId, 
                    role: 'patient', 
                    tokenVersion: 1,
                    sessionId: sessionId,
                    email: 'test@haemilife.com',
                    jti: jti
                },
                jwtSecret,
                { expiresIn: '1h' }
            );

            const res = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${token}`);

            // 🩺 Precise status check to ensure middleware and controller success
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify state transition (Institutional Grade - Data Driven Verification)
            expect(mockState.user!.token_version).toBe(2);
            expect(mockState.session!.revoked).toBe(true);

            // Verify the UPDATE query was called correctly
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringMatching(/update users set token_version = .*/i),
                expect.any(Array)
            );

            // Verify no cookie remains
            expect(res.headers['set-cookie']).toBeUndefined();
        });
    });
});
