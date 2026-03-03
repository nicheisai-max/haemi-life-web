import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api';

// DEMO MODE FLAG
const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

// Memory Token Storage (Closure)
let accessToken: string | null = null;

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
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void
}[] = [];

export const setAppInitialized = () => {
    appInitialized = true;
};

// Process initialization queue
if (typeof window !== 'undefined') {
    const checkBackendReady = async () => {
        try {
            const res = await axios.get(`${API_URL}/health/ready`, { timeout: 2000 });
            if (res.data?.status === 'ready') {
                return true;
            }
        } catch {
            return false;
        }
        return false;
    };

    const flushQueue = () => {
        appInitialized = true;
        initializationQueue.forEach(({ config, resolve, reject }) => {
            if (accessToken && config.headers) config.headers.Authorization = `Bearer ${accessToken}`;
            api(config).then(resolve).catch(reject);
        });
        initializationQueue = [];
    };

    const orchestrateStartup = async () => {
        // Phase 1: Wait for backend readiness (Exponential Backoff)
        let ready = false;
        let attempts = 0;
        while (!ready && attempts < 15) {
            ready = await checkBackendReady();
            if (!ready) {
                attempts++;
                await new Promise(r => setTimeout(r, Math.min(1000 * attempts, 5000)));
            }
        }

        // Phase 2: Wait for Auth Ready (if not already handled)
        if (appInitialized) {
            flushQueue();
        } else {
            window.addEventListener('auth:ready', flushQueue, { once: true });
        }
    };

    orchestrateStartup();
}

// Custom interface for request configuration
interface ExtendedRequestConfig extends InternalAxiosRequestConfig {
    __cachedData?: unknown;
    __retryCount?: number;
    _retry?: boolean;
}

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 1000;

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        ...(IS_DEMO_MODE ? { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' } : {}),
    },
    // PATCH: withCredentials false as we move away from cookies for multi-tab isolation
    withCredentials: false,
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

        const isDiscoveryRoute = config.url?.includes('/auth/') ||
            config.url?.includes('/health/') ||
            config.url?.includes('/profiles/me');
        if (!appInitialized && !isDiscoveryRoute) {
            return new Promise((resolve, reject) => {
                initializationQueue.push({ config, resolve, reject });
            }) as unknown as Promise<InternalAxiosRequestConfig>;
        }

        if (accessToken && config.headers) config.headers.Authorization = `Bearer ${accessToken}`;
        return config;
    },
    (error) => Promise.reject(error)
);

// ─── FIX 3 & 5: Single-Flight Refresh & Race Condition Handling ──────────────
let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
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

        // --- HARDENED NETWORK & STATUS HANDLING ---

        // 1. Network Error (Backend unreachable, CORS failure, etc.)
        if (!error.response) {
            // Do NOT trigger refresh. Just reject immediately. No console spam.
            return Promise.reject(error);
        }

        // 2. 500 Internal Server Error -> Do not loop, just reject
        if (error.response.status >= 500) {
            const isRetryable = error.response.status === 502 || error.response.status === 503 || error.response.status === 429;

            // Institutional Hardening: Notify user of catastrophic failure via global toast
            if (!isRetryable && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('system:error', {
                    detail: {
                        message: 'A critical system error occurred. Our technical team has been notified.',
                        statusCode: error.response.status
                    }
                }));
            }

            if (!isRetryable) {
                return Promise.reject(error);
            }
        }

        // 3. 403 Forbidden -> Force logout immediately
        if (error.response.status === 403) {
            clearAuthSession();
            return Promise.reject(error);
        }

        // 4. 401 Unauthorized Handling with Single-Flight Refresh
        if (error.response.status === 401 && !originalRequest._retry) {
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
                    if (originalRequest.headers) {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                    }
                    return api(originalRequest);
                }).catch(err => Promise.reject(err));
            }

            // Institutional Hardening: Session Recovery Window
            // If the app is still initializing (discovering session), we wait up to 5s
            // before giving up on a 401. This prevents race-based logouts on refresh.
            if (!appInitialized) {
                return new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        window.removeEventListener('auth:ready', onAuthReady);
                        reject(error);
                    }, 5000);

                    const onAuthReady = () => {
                        clearTimeout(timeout);
                        if (accessToken) {
                            if (originalRequest.headers) {
                                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                            }
                            resolve(api(originalRequest));
                        } else {
                            reject(error);
                        }
                    };
                    window.addEventListener('auth:ready', onAuthReady, { once: true });
                }) as unknown as Promise<unknown>;
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // PATCH: Send refreshToken in body for multi-tab isolation
                const currentRefreshToken = sessionStorage.getItem('refreshToken');

                // Perform the single refresh flight
                const response = await axios.post<{ success?: boolean; data?: { token?: string, refreshToken?: string } }>(
                    `${API_URL}/auth/refresh-token`,
                    { refreshToken: currentRefreshToken },
                    { timeout: 5000 } // No withCredentials needed anymore
                );

                if (!response.data.success || !response.data.data?.token) throw new Error('Refresh failed');

                const { token: newToken, refreshToken: newRefreshToken } = response.data.data;
                setAccessToken(newToken);

                if (newRefreshToken) {
                    sessionStorage.setItem('refreshToken', newRefreshToken);
                }

                isRefreshing = false;
                processQueue(null, newToken);

                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                }
                return api(originalRequest);
            } catch (rawErr: unknown) {
                isRefreshing = false;
                processQueue(rawErr, null);

                if (!appInitialized) return Promise.reject(rawErr);

                // Handle refresh failure (could be 401, 403, or Network Error)
                const error = rawErr as AxiosError;
                const isNetworkErr = !error.response;
                const isAuthRejection = error.response && (error.response.status === 401 || error.response.status === 403);

                // If it's a network error during refresh, or explicit rejection, we mark session invalid
                if (isNetworkErr || isAuthRejection) {
                    clearAuthSession();
                }

                return Promise.reject(rawErr);
            }
        }

        // Retry logic for 502/503/429
        if (originalRequest.__retryCount === undefined) originalRequest.__retryCount = 0;
        const isRetryable = error.response && (error.response.status === 502 || error.response.status === 503 || error.response.status === 429);

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
