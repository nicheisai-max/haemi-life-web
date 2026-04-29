// 🛡️ HAEMI LIFE: INSTITUTIONAL PROFILE INTEGRATION TEST (v2.1 - LATEST DATA SYNC)
// Engineering Standard: Google/Meta Grade Atomic Isolation + Metadata Integrity.

const JWT_SECRET = 'institutional_secret_v2_hardened';
process.env.JWT_SECRET = JWT_SECRET;
process.env.NODE_ENV = 'test';

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

jest.mock('../../utils/config.util', () => ({
    getSessionTimeoutMinutes: jest.fn().mockResolvedValue(60),
}));

import request from 'supertest';
import { app } from '../../app';
import { pool } from '../../config/db';
import * as jwt from 'jsonwebtoken';

describe('Profile API (V2.1 Hardened)', () => {
    let patientToken: string;
    let doctorToken: string;
    const patientId = '00000000-0000-0000-0000-000000000001';
    const doctorId = '00000000-0000-0000-0000-000000000002';

    beforeAll(() => {
        patientToken = jwt.sign(
            { id: patientId, sessionId: 's1', tokenVersion: 0, email: 'p@t.com', role: 'patient', jti: 'j1' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        doctorToken = jwt.sign(
            { id: doctorId, sessionId: 's2', tokenVersion: 0, email: 'd@t.com', role: 'doctor', jti: 'j2' },
            JWT_SECRET,
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

    beforeEach(() => {
        jest.clearAllMocks();
    });

    /**
     * 🛡️ INSTITUTIONAL HELPER: MOCK AUTH CHAIN
     * Including Profile Image Metadata (Mandatory since Phase 10 Update)
     */
    const mockAuthChain = (role: string, id: string) => {
        const mockQuery = pool.query as jest.Mock;
        
        // 1. User check (Must match AuthUserRow in auth.middleware.ts)
        mockQuery.mockResolvedValueOnce({
            rows: [{
                id, 
                name: 'Mock User', 
                status: 'ACTIVE', 
                role, 
                token_version: 0,
                email: 'mock@test.com', 
                initials: 'MU', 
                profile_image: null,      // 🧬 PHASE 10 SYNC
                profile_image_mime: null, // 🧬 PHASE 10 SYNC
                last_activity: new Date()
            }]
        });
        
        // 2. Session check
        mockQuery.mockResolvedValueOnce({
            rows: [{ revoked: false, last_activity: new Date() }]
        });
    };

    it('should fetch patient profile successfully', async () => {
        const mockQuery = pool.query as jest.Mock;
        mockAuthChain('patient', patientId);
        
        // 3. Controller query (Profile resolution with metadata)
        mockQuery.mockResolvedValueOnce({
            rows: [{
                id: patientId, 
                email: 'p@t.com', 
                role: 'patient', 
                name: 'Test Patient',
                initials: 'TP', 
                status: 'ACTIVE', 
                profile_image: null,      // 🧬 SYNC
                profile_image_mime: null, // 🧬 SYNC
                metadata: { dateOfBirth: '1990-01-01' }
            }]
        });

        const res = await request(app)
            .get('/api/profiles/me')
            .set('Authorization', `Bearer ${patientToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.profile.fullName).toBe('Test Patient');
    });

    it('should fetch doctor profile successfully', async () => {
        const mockQuery = pool.query as jest.Mock;
        mockAuthChain('doctor', doctorId);
        
        mockQuery.mockResolvedValueOnce({
            rows: [{
                id: doctorId, 
                email: 'd@t.com', 
                role: 'doctor', 
                name: 'Test Doctor',
                initials: 'TD', 
                status: 'ACTIVE', 
                profile_image: null,      // 🧬 SYNC
                profile_image_mime: null, // 🧬 SYNC
                metadata: { specialization: 'Cardiology' }
            }]
        });

        const res = await request(app)
            .get('/api/profiles/me')
            .set('Authorization', `Bearer ${doctorToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.profile.fullName).toBe('Test Doctor');
    });

    it('should return 401 for unauthorized access', async () => {
        const res = await request(app).get('/api/profiles/me');
        expect(res.status).toBe(401);
    });

    it('should return 404 for missing profile', async () => {
        const mockQuery = pool.query as jest.Mock;
        mockAuthChain('patient', patientId);

        mockQuery.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .get('/api/profiles/me')
            .set('Authorization', `Bearer ${patientToken}`);

        expect(res.status).toBe(404);
        expect(res.body.code).toBe('NOT_FOUND');
    });
});
