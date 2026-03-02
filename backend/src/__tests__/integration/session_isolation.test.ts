import request from 'supertest';
import { app } from '../../app';
import { pool } from '../../config/db';
import * as jwt from 'jsonwebtoken';

// Mock DB to prevent real schema mutations during test
jest.mock('../../config/db', () => ({
    pool: {
        query: jest.fn(),
        connect: jest.fn(),
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
            const mockQuery = pool.query as jest.Mock;

            // 1. Create a "stale" refresh token (version 0)
            const staleToken = jwt.sign(
                { id: userId, token_version: 0 },
                jwtSecret,
                { expiresIn: '7d' }
            );

            // 2. Mock DB to return user with version 1 (revoked version 0)
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    id: userId,
                    email: 'test@haemilife.com',
                    role: 'patient',
                    status: 'ACTIVE',
                    token_version: 1 // DB has version 1, token has version 0
                }]
            });

            // Mock the version increment on reuse detection
            mockQuery.mockResolvedValueOnce({ rows: [] });

            // 3. Attempt to refresh
            const res = await request(app)
                .post('/api/auth/refresh-token')
                .set('Cookie', [`refreshToken=${staleToken}`]);

            // 4. Verify rejection
            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/Session revoked/i);

            // Verify that the cookie was cleared
            const setCookie = res.headers['set-cookie'][0];
            expect(setCookie).toMatch(/refreshToken=;/i);
            expect(setCookie).toMatch(/HttpOnly/i);
        });

        it('should accept refresh token with matching token_version', async () => {
            const mockQuery = pool.query as jest.Mock;

            // 1. Create a "valid" refresh token (version 1)
            const validToken = jwt.sign(
                { id: userId, token_version: 1 },
                jwtSecret,
                { expiresIn: '7d' }
            );

            // 2. Mock DB to return user with matching version 1
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    id: userId,
                    email: 'test@haemilife.com',
                    role: 'patient',
                    status: 'ACTIVE',
                    token_version: 1 // Match!
                }]
            });

            // 3. Mock the activity update query
            mockQuery.mockResolvedValueOnce({ rows: [] });

            // 4. Attempt to refresh
            const res = await request(app)
                .post('/api/auth/refresh-token')
                .set('Cookie', [`refreshToken=${validToken}`]);

            // 5. Verify success
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.token).toBeDefined();

            // Verify new cookie is set with strict settings
            const setCookie = res.headers['set-cookie'][0];
            expect(setCookie).toMatch(/HttpOnly/i);
            expect(setCookie).toMatch(/SameSite=Strict/i);
            expect(setCookie).toMatch(/path=\//i);
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

            // Verify cookie is cleared with path=/
            const setCookie = res.headers['set-cookie'][0];
            expect(setCookie).toMatch(/refreshToken=;/i);
            expect(setCookie).toMatch(/path=\//i);
        });
    });
});
