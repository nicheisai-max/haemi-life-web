import request from 'supertest';
import { app } from '../../app';
import { pool } from '../../config/db';

jest.mock('../../config/db', () => ({
    pool: {
        query: jest.fn(),
        end: jest.fn(),
    }
}));

beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
    jest.spyOn(console, 'info').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
});

afterAll(async () => {
    if (pool && typeof pool.end === 'function') {
        await pool.end();
    }
    jest.restoreAllMocks();
});

describe('System Health & DB Orchestration (Integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /health', () => {
        it('should return 200 when backend and DB are fully operational', async () => {
            (pool.query as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });

            const res = await request(app).get('/health');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.db).toBe('connected');
        });

        it('should return 500 when DB falls offline', async () => {
            (pool.query as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

            const res = await request(app).get('/health');
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
            expect(res.body.data.db).toBe('disconnected');
        });
    });
});
