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
        beforeEach(() => {
            jest.clearAllMocks();
            
            // Centralized Deterministic Pool Mock
            (pool.query as jest.Mock).mockImplementation(async (sql: string) => {
                if (sql.includes('system_settings')) {
                    if (sql.includes('SESSION_TIMEOUT_MINUTES')) return { rows: [{ value: '60' }] };
                    if (sql.includes('JWT_ACCESS_EXPIRY_MINUTES')) return { rows: [{ value: '15' }] };
                    if (sql.includes('JWT_REFRESH_EXPIRY_DAYS')) return { rows: [{ value: '7' }] };
                    return { rows: [] };
                }
                if (sql.includes('UPDATE users SET last_activity')) return { rows: [] };
                if (sql.includes('UPDATE users SET token_version')) return { rows: [] };
                return { rows: [] };
            });
        });

        it('should reject refresh token with mismatched token_version', async () => {
            const mockClientQuery = mockClient.query as jest.Mock;

            // 1. Create a "stale" refresh token (version 0)
            const staleToken = jwt.sign(
                { id: userId, token_version: 0, session_id: 's1', jti: 'j1' },
                jwtSecret,
                { expiresIn: '7d' }
            );

            // 2. Mock DB to return user with version 1 (revoked version 0)
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

            // Mock the session revocation and commit
            mockClientQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE
            mockClientQuery.mockResolvedValueOnce({ rows: [] }); // COMMIT

            // 3. Attempt to refresh
            const res = await request(app)
                .post('/api/auth/refresh-token')
                .send({ refreshToken: staleToken });

            // 4. Verify rejection
            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/Session revoked due to security violation/i);

            // Verify that the cookie is NOT set anymore (no need to check clearing since we don't use it)
            expect(res.headers['set-cookie']).toBeUndefined();
        });

        it('should accept refresh token with matching token_version', async () => {
            const mockClientQuery = mockClient.query as jest.Mock;

            // 1. Create a "valid" refresh token (version 1)
            const validToken = jwt.sign(
                { id: userId, token_version: 1, session_id: 's2', jti: 'j2' },
                jwtSecret,
                { expiresIn: '7d' }
            );

            // 2. Mock DB to return user with matching version 1
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

            // 3. Mock the session check
            mockClientQuery.mockResolvedValueOnce({
                rows: [{
                    refresh_token_jti: 'j2',
                    revoked: false
                }]
            });

            // 4. Mock the rotation update
            mockClientQuery.mockResolvedValueOnce({ rows: [] });
            // 5. Mock the user activity update
            mockClientQuery.mockResolvedValueOnce({ rows: [] });
            // 6. Mock COMMIT
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

            // Verify no cookie is set
            expect(res.headers['set-cookie']).toBeUndefined();
        });
    });

    describe('Logout Revocation', () => {
        it('should increment token_version on logout', async () => {
            const mockQuery = pool.query as jest.Mock;

            // Mock token for auth middleware
            const token = jwt.sign(
                { id: userId, role: 'patient', token_version: 1 },
                jwtSecret,
                { expiresIn: '1h' }
            );

            // 1. SELECT user (for authenticateToken)
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    name: 'Test',
                    initials: 'T',
                    profile_image: null,
                    status: 'ACTIVE',
                    role: 'patient',
                    token_version: 1,
                    minutes_since_activity: 5
                }]
            });
            // 2. UPDATE last_activity (for authenticateToken)
            mockQuery.mockResolvedValueOnce({ rows: [] });

            // Mock the UPDATE query in logout
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify the UPDATE query was called to increment token_version
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE users SET token_version = token_version \+ 1/i),
                [userId]
            );

            // Verify no cookie is cleared
            expect(res.headers['set-cookie']).toBeUndefined();
        });
    });
});
