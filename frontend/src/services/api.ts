import axios, { AxiosError, type InternalAxiosRequestConfig, type AxiosRequestConfig } from 'axios';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api';

// DEMO MODE FLAG
// @ts-ignore
const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

// Memory Token Storage (Closure)
let accessToken: string | null = null;

// Task 5: DEMO SHIELD LOCK
// @ts-ignore
const DEMO_SHIELD = import.meta.env.VITE_DEMO_SHIELD === 'true' || IS_DEMO_MODE;

export const setAccessToken = (token: string | null) => {
    accessToken = token;
    // FIX 4: Notify system of token update for socket revalidation
    if (typeof window !== 'undefined' && token) {
        window.dispatchEvent(new CustomEvent('auth:token-refreshed', { detail: { token } }));
    }
};

export const getAccessToken = () => accessToken;

// ─── Request Buffer Logic (Resilience Engine) ────────────────────────────────
let appInitialized = false;
let initializationQueue: {
    config: ExtendedRequestConfig;
    resolve: (value: any) => void;
    reject: (reason?: any) => void
}[] = [];

export const setAppInitialized = () => {
    appInitialized = true;
};

// Process initialization queue
if (typeof window !== 'undefined') {
    window.addEventListener('auth:ready', () => {
        appInitialized = true;
        initializationQueue.forEach(({ config, resolve, reject }) => {
            if (accessToken && config.headers) config.headers.Authorization = `Bearer ${accessToken}`;
            api(config).then(resolve).catch(reject);
        });
        initializationQueue = [];
    });
}

// Custom interface for request configuration
interface ExtendedRequestConfig extends InternalAxiosRequestConfig {
    __cachedData?: unknown;
    __retryCount?: number;
    _retry?: boolean;
}

const SENSITIVE_ROUTE_PATTERNS = ['/auth/', '/admin/', '/records/', '/prescriptions/', '/chat/', '/notifications/', '/password-reset/'];

function isSensitiveRoute(url: string | undefined): boolean {
    if (!url) return true;
    return SENSITIVE_ROUTE_PATTERNS.some(pattern => url.includes(pattern));
}

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 1000;

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        ...(IS_DEMO_MODE ? { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' } : {}),
    },
    withCredentials: true,
    timeout: 10000,
});

// ─── Circuit Breaker ─────────────────────────────────────────────────────────
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
let failureCount = 0;
let circuitState: CircuitState = 'CLOSED';
let nextTryTime = 0;
const FAILURE_THRESHOLD = 5;
const COOLDOWN_PERIOD = 10000;

function checkCircuitBreaker(): boolean {
    if (circuitState === 'CLOSED') return true;
    if (circuitState === 'OPEN') {
        if (Date.now() >= nextTryTime) {
            circuitState = 'HALF_OPEN';
            console.warn('[Circuit] Testing recovery...');
            return true;
        }
        return false;
    }
    return false; // In HALF_OPEN, allow only the first request
}

function recordSuccess() {
    failureCount = 0;
    circuitState = 'CLOSED';
}

function recordFailure(error: AxiosError) {
    const isNetworkError = !error.response || error.code === 'ECONNABORTED';
    const isServerOverloaded = error.response && (error.response.status === 502 || error.response.status === 503);
    if (!isNetworkError && !isServerOverloaded) return;

    failureCount++;
    if (failureCount >= FAILURE_THRESHOLD && circuitState !== 'OPEN') {
        circuitState = 'OPEN';
        nextTryTime = Date.now() + COOLDOWN_PERIOD;
        console.error(`[Circuit] Open for ${COOLDOWN_PERIOD / 1000}s.`);
    } else if (circuitState === 'HALF_OPEN') {
        circuitState = 'OPEN';
        nextTryTime = Date.now() + COOLDOWN_PERIOD;
    }
}

// Request Interceptor
api.interceptors.request.use(
    (config: ExtendedRequestConfig) => {
        if (!checkCircuitBreaker()) {
            return Promise.reject(new Error('Circuit is OPEN.'));
        }

        const isAuthRoute = config.url?.includes('/auth/');
        if (!appInitialized && !isAuthRoute) {
            return new Promise((resolve, reject) => {
                initializationQueue.push({ config, resolve, reject });
            }) as any;
        }

        if (accessToken && config.headers) config.headers.Authorization = `Bearer ${accessToken}`;
        return config;
    },
    (error) => Promise.reject(error)
);

// ─── FIX 3 & 5: Single-Flight Refresh & Race Condition Handling ──────────────
let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: any) => void }[] = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) prom.reject(error);
        else if (token) prom.resolve(token);
    });
    failedQueue = [];
};

const clearAuthSession = () => {
    if (!appInitialized) return;
    isRefreshing = false;
    setAccessToken(null);
    sessionStorage.removeItem('user');
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
};

const SESSION_NEUTRAL_ENDPOINTS = ['/notifications', '/chat/messages', '/chat/'];
const isSessionNeutral = (url?: string): boolean => !!url && SESSION_NEUTRAL_ENDPOINTS.some(p => url.includes(p));

api.interceptors.response.use(
    async (response) => {
        if (response.data && typeof response.data === 'object' && 'success' in response.data && 'data' in response.data) {
            response.data = response.data.data;
        }
        recordSuccess();
        return response;
    },
    async (error: AxiosError) => {
        const originalRequest = error.config as ExtendedRequestConfig;
        recordFailure(error);

        if (!originalRequest) return Promise.reject(error);

        // 401 Handling with Single-Flight Refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
            // If the refresh-token endpoint itself fails with 401, session is dead.
            if (originalRequest.url?.includes('/auth/refresh-token')) {
                clearAuthSession();
                return Promise.reject(error);
            }

            // FIX 3: Multi-tab stampede protection - Queue requests if refresh is in progress
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                }).catch(err => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Perform the single refresh flight
                const response = await axios.post<{ success?: boolean; data?: { token?: string } }>(
                    `${API_URL}/auth/refresh-token`,
                    {},
                    { withCredentials: true }
                );

                if (!response.data.success || !response.data.data?.token) throw new Error('Refresh failed');

                const token = response.data.data.token;
                setAccessToken(token);
                isRefreshing = false;
                processQueue(null, token);

                originalRequest.headers.Authorization = `Bearer ${token}`;
                return api(originalRequest);
            } catch (rawErr: any) {
                isRefreshing = false;
                processQueue(rawErr, null);

                if (!appInitialized) return Promise.reject(rawErr);

                const isAuthRejection = rawErr.response && (rawErr.response.status === 401 || rawErr.response.status === 403);
                const isCritical = !isSessionNeutral(originalRequest.url) && !originalRequest.url?.includes('/auth/me');

                if (isCritical && isAuthRejection) clearAuthSession();
                return Promise.reject(rawErr);
            }
        }

        // Retry logic for 5xx/429
        if (originalRequest.__retryCount === undefined) originalRequest.__retryCount = 0;
        const isRetryable = error.response && (error.response.status >= 500 || error.response.status === 429);

        if (originalRequest.__retryCount < MAX_RETRIES && isRetryable) {
            originalRequest.__retryCount += 1;
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, originalRequest.__retryCount);
            await new Promise(resolve => setTimeout(resolve, delay));
            return api(originalRequest);
        }

        return Promise.reject(error);
    }
);

export default api;
