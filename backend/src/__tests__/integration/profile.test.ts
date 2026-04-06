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
        // Use a fixed secret for testing
        process.env.JWT_SECRET = 'testsecret';

        // Setup mock tokens with institutional complexity (must match JwtPayloadStrict)
        patientToken = jwt.sign(
            { 
                id: patientId, 
                sessionId: 'session-123',
                tokenVersion: 0,
                email: 'patient@test.com',
                role: 'patient',
                jti: 'jti-123'
            },
            'testsecret',
            { expiresIn: '1h' }
        );
        doctorToken = jwt.sign(
            { 
                id: doctorId, 
                sessionId: 'session-456',
                tokenVersion: 0,
                email: 'doctor@test.com',
                role: 'doctor',
                jti: 'jti-456'
            },
            'testsecret',
            { expiresIn: '1h' }
        );

        // Silence console out during tests
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
        jest.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterAll(async () => {
        if (pool && typeof pool.end === 'function') {
            await pool.end();
        }
        jest.restoreAllMocks();
    });

    it('should fetch patient profile with metadata', async () => {
        const mockQuery = pool.query as jest.Mock;

        // 1. SELECT user (for authenticateToken)
        mockQuery.mockResolvedValueOnce({
            rows: [{
                name: 'Test Patient',
                initials: 'TP',
                profile_image: null,
                profile_image_mime: null,
                status: 'ACTIVE',
                role: 'patient',
                token_version: 0,
                lastActivity: new Date(),
                minutes_since_activity: 0
            }]
        });
        // 2. SELECT session (for authenticateToken)
        mockQuery.mockResolvedValueOnce({
            rows: [{
                revoked: false,
                access_token_jti: 'jti-123',
                lastActivity: new Date()
            }]
        });
        
        // 3. Mock DB result for profile controller (Actual logic)
        // P0 FIX: Field 'name' is required for profile.fullName resolution
        mockQuery.mockResolvedValueOnce({
            rows: [{
                id: patientId,
                email: 'patient@test.com',
                phone_number: '555-010-999',
                role: 'patient',
                name: 'Test Patient',
                initials: 'TP',
                status: 'ACTIVE',
                avatar: null,
                metadata: {
                    dateOfBirth: '1990-01-01',
                    gender: 'Male',
                    bloodGroup: 'O+',
                    emergencyContact: { name: 'Emergency', phone: '911' },
                    allergies: 'None',
                    medicalConditions: 'None'
                }
            }]
        });

        const res = await request(app)
            .get('/api/profiles/me')
            .set('Authorization', `Bearer ${patientToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.role).toBe('patient');
        expect(res.body.data.profile.fullName).toBe('Test Patient');
    });

    it('should fetch doctor profile with metadata', async () => {
        const mockQuery = pool.query as jest.Mock;

        // 1. SELECT user
        mockQuery.mockResolvedValueOnce({
            rows: [{
                name: 'Test Doctor',
                initials: 'TD',
                profile_image: null,
                profile_image_mime: null,
                status: 'ACTIVE',
                role: 'doctor',
                token_version: 0,
                lastActivity: new Date(),
                minutes_since_activity: 0
            }]
        });
        // 2. SELECT session
        mockQuery.mockResolvedValueOnce({
            rows: [{
                revoked: false,
                access_token_jti: 'jti-456',
                lastActivity: new Date()
            }]
        });
        
        // 3. Mock DB result for profile controller
        // P0 FIX: Field 'name' is required for profile.fullName resolution
        mockQuery.mockResolvedValueOnce({
            rows: [{
                id: doctorId,
                email: 'doctor@test.com',
                phone_number: '0987654321',
                role: 'doctor',
                name: 'Test Doctor',
                initials: 'TD',
                status: 'ACTIVE',
                avatar: null,
                metadata: {
                    specialization: 'Cardiology',
                    yearsOfExperience: 10,
                    bio: 'Experienced cardiologist',
                    consultationFee: 50.00,
                    licenseNumber: 'DOC123'
                }
            }]
        });

        const res = await request(app)
            .get('/api/profiles/me')
            .set('Authorization', `Bearer ${doctorToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.role).toBe('doctor');
        expect(res.body.data.profile.fullName).toBe('Test Doctor');
    });

    it('should return 401 if no token provided', async () => {
        const res = await request(app).get('/api/profiles/me');
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    it('should return 404 if profile not found in DB', async () => {
        const mockQuery = pool.query as jest.Mock;

        // 1. SELECT user
        mockQuery.mockResolvedValueOnce({
            rows: [{
                name: 'Test Patient',
                initials: 'TP',
                profile_image: null,
                profile_image_mime: null,
                status: 'ACTIVE',
                role: 'patient',
                token_version: 0,
                lastActivity: new Date(),
                minutes_since_activity: 0
            }]
        });
        // 2. SELECT session
        mockQuery.mockResolvedValueOnce({
            rows: [{
                revoked: false,
                access_token_jti: 'jti-123',
                lastActivity: new Date()
            }]
        });

        // 3. Mock DB result for profile controller (not found)
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .get('/api/profiles/me')
            .set('Authorization', `Bearer ${patientToken}`);

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('Profile not found');
        expect(res.body.code).toBe('NOT_FOUND');
    });
});
