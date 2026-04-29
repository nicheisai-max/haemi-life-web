// 🛡️ PHASE 10: INSTITUTIONAL HOISTING (Absolute Top)
const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
};

jest.mock('../../config/db', () => ({
    pool: {
        query: jest.fn(),
        connect: jest.fn(() => Promise.resolve(mockClient)),
        end: jest.fn(),
    },
    checkConnection: jest.fn().mockResolvedValue(undefined),
}));

// 🛡️ LOCKING CONFIG DRIFT: Prevent background DB hits during Auth Middleware pulse
jest.mock('../../utils/config.util', () => ({
    getSessionTimeoutMinutes: jest.fn().mockResolvedValue(60),
}));

import request from 'supertest';
import { app } from '../../app';
import { pool } from '../../config/db';
import * as jwt from 'jsonwebtoken';

describe('Profile API (Integration)', () => {
    let patientToken: string;
    let doctorToken: string;
    const patientId = '00000000-0000-0000-0000-000000000001';
    const doctorId = '00000000-0000-0000-0000-000000000002';

    beforeAll(() => {
        process.env.JWT_SECRET = 'testsecret';

        patientToken = jwt.sign(
            { id: patientId, sessionId: 's1', tokenVersion: 0, email: 'p@t.com', role: 'patient', jti: 'j1' },
            'testsecret',
            { expiresIn: '1h' }
        );
        doctorToken = jwt.sign(
            { id: doctorId, sessionId: 's2', tokenVersion: 0, email: 'd@t.com', role: 'doctor', jti: 'j2' },
            'testsecret',
            { expiresIn: '1h' }
        );

        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterAll(async () => {
        if (pool && typeof pool.end === 'function') {
            await pool.end();
        }
        jest.restoreAllMocks();
    });

    // 🛡️ ATOMIC ISOLATION: Reset pool mocks before every test to prevent sequence leak
    beforeEach(() => {
        jest.clearAllMocks();
    });

    /**
     * 🛡️ INSTITUTIONAL HELPER: MOCK AUTH CHAIN
     * Deterministic satisfaction of authenticateToken middleware requirements.
     */
    const mockAuthChain = (role: string, tokenVersion: number = 0) => {
        const mockQuery = pool.query as jest.Mock;
        
        // 1. User check (SELECT FROM users)
        mockQuery.mockResolvedValueOnce({
            rows: [{
                id: 'mock-id', name: 'Mock User', status: 'ACTIVE', role, token_version: tokenVersion,
                email: 'mock@test.com', initials: 'MU', last_activity: new Date()
            }]
        });
        
        // 2. Session check (SELECT FROM user_sessions)
        mockQuery.mockResolvedValueOnce({
            rows: [{ revoked: false, last_activity: new Date() }]
        });
    };

    it('should fetch patient profile with metadata', async () => {
        const mockQuery = pool.query as jest.Mock;
        mockAuthChain('patient');
        
        // 3. Controller query (Profile resolution)
        mockQuery.mockResolvedValueOnce({
            rows: [{
                id: patientId, email: 'p@t.com', role: 'patient', name: 'Test Patient',
                initials: 'TP', status: 'ACTIVE', metadata: { dateOfBirth: '1990-01-01' }
            }]
        });

        const res = await request(app)
            .get('/api/profiles/me')
            .set('Authorization', `Bearer ${patientToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.profile.fullName).toBe('Test Patient');
    });

    it('should fetch doctor profile with metadata', async () => {
        const mockQuery = pool.query as jest.Mock;
        mockAuthChain('doctor');
        
        // 3. Controller query
        mockQuery.mockResolvedValueOnce({
            rows: [{
                id: doctorId, email: 'd@t.com', role: 'doctor', name: 'Test Doctor',
                initials: 'TD', status: 'ACTIVE', metadata: { specialization: 'Cardiology' }
            }]
        });

        const res = await request(app)
            .get('/api/profiles/me')
            .set('Authorization', `Bearer ${doctorToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.profile.fullName).toBe('Test Doctor');
    });

    it('should return 401 if no token provided', async () => {
        const res = await request(app).get('/api/profiles/me');
        expect(res.status).toBe(401);
    });

    it('should return 404 if profile not found in DB', async () => {
        const mockQuery = pool.query as jest.Mock;
        mockAuthChain('patient');

        // 3. Controller query (NOT FOUND scenario)
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .get('/api/profiles/me')
            .set('Authorization', `Bearer ${patientToken}`);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Profile not found');
        expect(res.body.code).toBe('NOT_FOUND');
    });
});
