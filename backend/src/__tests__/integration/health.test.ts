import request from 'supertest';
import { app } from '../../app';
import { pool, checkConnection } from '../../config/db';

jest.mock('../../config/db', () => ({
    pool: {
        query: jest.fn(),
        connect: jest.fn(),
        end: jest.fn(),
    },
    checkConnection: jest.fn()
}));

beforeAll(() => {
    // Silence console out during tests
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
});

afterAll(async () => {
    await pool.end();
    jest.restoreAllMocks();
});

describe('Health Probes (Integration)', () => {

    describe('GET /health', () => {
        it('should return 200 when backend and DB are fully operational', async () => {
            (checkConnection as jest.Mock).mockResolvedValueOnce(undefined);

            const res = await request(app).get('/health');
            expect(res.status).toBe(200);
            expect(res.body.server).toBe('up');
            expect(res.body.database).toBe('connected');
        });

        it('should return 503 when DB falls offline', async () => {
            (checkConnection as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

            const res = await request(app).get('/health');
            expect(res.status).toBe(503);
            expect(res.body.database).toBe('disconnected');
        });
    });
});
