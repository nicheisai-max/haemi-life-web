import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import api, { setAppInitialized, setAccessToken } from '../services/api';

describe('Global Axios Interceptors (api.ts)', () => {
    let mock: MockAdapter;

    beforeAll(() => {
        setAppInitialized(); // Unlock interceptor queue
    });

    beforeEach(() => {
        // We bypass the underlying axios instance attached to our api object
        mock = new MockAdapter(api);
        // We also need to mock global axios since api interpolates `axios.post` manually for token refreshes
    });

    afterEach(() => {
        mock.restore();
    });

    it('should reject network errors immediately without triggering refresh loops', async () => {
        // Simulate a complete failure to connect (network down)
        mock.onGet('/some-endpoint').networkError();

        await expect(api.get('/some-endpoint')).rejects.toThrow('Network Error');
        // We verify that the interceptor rejected it and didn't fall into an infinite loop.
    });

    it('should NOT force logout on 403 Forbidden (Institutional Standard)', async () => {
        // Mock a 403 response
        mock.onGet('/admin-dashboard').reply(403);
        setAccessToken('mock-session-token'); 

        // Listen to custom event - we expect this NOT to be called for 403
        const spyEvent = vi.fn();
        window.addEventListener('auth:unauthorized', spyEvent);

        try {
            await api.get('/admin-dashboard');
        } catch (e: unknown) {
            const err = e as { response?: { status?: number } };
            expect(err.response?.status).toBe(403);
        }

        // Institutional Parity: 403 is Forbidden, but NOT an identity failure (Unauthorized)
        expect(spyEvent).not.toHaveBeenCalled();
        window.removeEventListener('auth:unauthorized', spyEvent);
    });

    // 500 retry logic can also be tested similarly:
    it('should retry 502/503/429 errors', async () => {
        mock.onGet('/flaky').replyOnce(502).onGet('/flaky').reply(200, { success: true, data: { msg: 'ok' } });

        const res = await api.get('/flaky');
        expect(res.data.data.msg).toBe('ok');
    });
});
