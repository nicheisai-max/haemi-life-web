import request from 'supertest';
import { app } from '../../app';
import { pool } from '../../config/db';
import * as jwt from 'jsonwebtoken';

// Mock DB to prevent real schema mutations during test
const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
};

jest.mock('../../config/db', () => ({
    pool: {
        query: jest.fn(),
        connect: jest.fn(() => Promise.resolve(mockClient)),
        end: jest.fn(),
    }
}));

describe('Session Isolation (Phase 2)', () => {
    const userId = '00000000-0000-0000-0000-000000000001';
    const jwtSecret = process.env.JWT_SECRET || 'testsecret';

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

    describe('Cookie Security & Revocation', () => {
        it('should reject refresh token with mismatched token_version', async () => {
            const mockClientQuery = mockClient.query as jest.Mock;

            // 1. Create a "stale" refresh token (version 0)
            const staleToken = jwt.sign(
                { id: userId, token_version: 0, session_id: 's1', jti: 'j1' },
                jwtSecret,
                { expiresIn: '7d' }
            );

            // 2. Mock DB sequences (Transaction Client):
            mockClientQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
            mockClientQuery.mockResolvedValueOnce({
                rows: [{
                    id: userId,
                    email: 'test@haemilife.com',
                    role: 'patient',
                    status: 'ACTIVE',
                    token_version: 1 // DB has version 1, token has version 0
                }]
            });

            // Mock the sessionRes check
            mockClientQuery.mockResolvedValueOnce({
                rows: [{
                    refresh_token_jti: 'j1',
                    revoked: false
                }]
            });

            // 3. Attempt to refresh
            const res = await request(app)
                .post('/api/auth/refresh-token')
                .send({ refreshToken: staleToken });

            // 4. Verify rejection
            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/Session invalid or revoked/i);
        });

        it('should accept refresh token with matching token_version', async () => {
            const mockClientQuery = mockClient.query as jest.Mock;
            const mockPoolQuery = pool.query as jest.Mock;

            // 1. Create a "valid" refresh token (version 1)
            const validToken = jwt.sign(
                { id: userId, token_version: 1, session_id: 's2', jti: 'j2' },
                jwtSecret,
                { expiresIn: '7d' }
            );

            // 2. Mock DB sequence (Transaction Client)
            mockClientQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN
            mockClientQuery.mockResolvedValueOnce({
                rows: [{
                    id: userId,
                    email: 'test@haemilife.com',
                    role: 'patient',
                    status: 'ACTIVE',
                    token_version: 1 // Match!
                }]
            });

            // 3. Mock the session check (Still Client)
            mockClientQuery.mockResolvedValueOnce({
                rows: [{
                    refresh_token_jti: 'j2',
                    previous_refresh_token_jti: null,
                    jti_rotated_at: null,
                    access_token_jti: 'a2',
                    revoked: false,
                    ip_address: '::ffff:127.0.0.1', // Match test default IP
                    user_agent: undefined
                }]
            });

            // 4. Mock the system settings check (POOL query - via singleton repository)
            mockPoolQuery.mockResolvedValueOnce({ rows: [{ value: '60' }] });

            // 5. Mock the rotation update (Client)
            mockClientQuery.mockResolvedValueOnce({ rows: [] });
            // 6. Mock the user activity update (Client)
            mockClientQuery.mockResolvedValueOnce({ rows: [] });
            // 7. Mock COMMIT (Client)
            mockClientQuery.mockResolvedValueOnce({ rows: [] });

            // 4. Attempt to refresh
            const res = await request(app)
                .post('/api/auth/refresh-token')
                .send({ refreshToken: validToken });

            // 5. Verify success
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.token).toBeDefined();
            expect(res.body.data.refreshToken).toBeDefined();
        });
    });

    describe('Logout Revocation', () => {
        it('should handle logout correctly', async () => {
            const mockPoolQuery = pool.query as jest.Mock;

            // Mock token for auth middleware - now requires session_id for full hardening coverage
            const token = jwt.sign(
                { id: userId, role: 'patient', token_version: 1, session_id: 'sess_logout', jti: 'j_logout' },
                jwtSecret,
                { expiresIn: '1h' }
            );

            // 1. SELECT user (for authenticateToken)
            mockPoolQuery.mockResolvedValueOnce({
                rows: [{
                    name: 'Test',
                    initials: 'T',
                    profile_image: null,
                    status: 'ACTIVE',
                    role: 'patient',
                    token_version: 1
                }]
            });

            // 2. SELECT session (for authenticateToken)
            mockPoolQuery.mockResolvedValueOnce({
                rows: [{
                    revoked: false,
                    access_token_jti: 'j_logout',
                    ip_address: '::ffff:127.0.0.1',
                    user_agent: undefined,
                    expires_at: new Date(Date.now() + 3600000)
                }]
            });

            // 3. systemSettings lookup in middleware
            mockPoolQuery.mockResolvedValueOnce({ rows: [{ value: '60' }] });

            // 4. UPDATE user_sessions (heartbeat in middleware)
            mockPoolQuery.mockResolvedValueOnce({ rows: [] });

            // 5. UPDATE user activity (in middleware)
            mockPoolQuery.mockResolvedValueOnce({ rows: [] });

            // --- CONTROLLER LOGIC STARTS ---
            // 6. UPDATE user_sessions (revocation in logout controller)
            mockPoolQuery.mockResolvedValueOnce({ rows: [] });

            // 7. UPDATE user (token_version increment in logout controller)
            mockPoolQuery.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify the UPDATE query was called to increment token_version
            expect(mockPoolQuery).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE users SET token_version = token_version \+ 1/i),
                expect.any(Array)
            );
        });
    });
});
