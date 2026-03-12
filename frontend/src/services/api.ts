import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { logger } from '../utils/logger';

const API_BASE = import.meta.env.VITE_API_URL;
if (!API_BASE) {
    console.error('[API] WARNING: VITE_API_URL is missing. Falling back to relative path.');
}
const API_URL = (API_BASE || '') + '/api';

// DEMO MODE FLAG
const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

// Memory Token Storage (Closure)
let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
    accessToken = token;
    
    // Phase 7: Atomic Network Layer Sync
    if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        delete api.defaults.headers.common['Authorization'];
    }

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
            // Priority: Access the latest atomic token
            const token = accessToken || sessionStorage.getItem('token');
            if (token && config.headers) {
                config.headers.Authorization = `Bearer ${token}`;
            }
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

        // Phase 6 Hardening: /profiles/me is allowed to bypass initialization queue 
        // specifically to permit AuthProvider to resolve the boot state.
        if (!appInitialized && !isDiscoveryRoute) {
            return new Promise((resolve, reject) => {
                initializationQueue.push({ config, resolve, reject });
            }) as unknown as Promise<InternalAxiosRequestConfig>;
        }

        if (accessToken && config.headers) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        } else {
            // Institutional Hardening: If memory token is null, check sessionStorage before failing
            const sessionToken = sessionStorage.getItem('token');
            if (sessionToken && config.headers) {
                config.headers.Authorization = `Bearer ${sessionToken}`;
                accessToken = sessionToken; // Restore to memory
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ─── Phase 2, 5 & 6: Refresh Engine & Safety Guards ──────────────────────────
let lastSystemErrorTime = 0;
let refreshPromise: Promise<string | null> | null = null;
let failedQueue: { resolve: (token: string | null) => void; reject: (err: unknown) => void }[] = [];
let sessionVersion = 0; // Guard against "Token Resurrection" race conditions

const processQueue = (error: unknown, token: string | null = null) => {
    const queueToProcess = [...failedQueue];
    failedQueue = [];
    queueToProcess.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
};

const clearAuthSession = () => {
    sessionVersion++; // Invalidate any pending refresh results
    refreshPromise = null;
    
    // Phase 7: Atomic state clearing (Memory + Network + Storage)
    setAccessToken(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
    
    // Deterministic Queue Cleanout
    processQueue(new Error('Session terminated'));
    
    logger.warn('[API] Local session cleared. Dispatching auth:unauthorized event.');
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
};

export const performRefresh = async (retryCount = 0): Promise<string | null> => {
    if (refreshPromise) {
        logger.info('[API] Token refresh already in progress, attaching to existing promise.');
        return refreshPromise;
    }

    const currentVersion = sessionVersion;

    refreshPromise = (async () => {
        try {
            const currentRefreshToken = sessionStorage.getItem('refreshToken');
            if (!currentRefreshToken) {
                logger.warn('[API] Proactive refresh aborted: no refresh token found in storage');
                throw new Error('No refresh token available');
            }

            logger.info(`[API] Initiating synchronized token refresh (Attempt ${retryCount + 1})`);
            const response = await axios.post<{ success?: boolean; data?: { token?: string, refreshToken?: string } }>(
                `${API_URL}/auth/refresh-token`,
                { refreshToken: currentRefreshToken },
                { timeout: 8000 }
            );

            // Phase 6 Safety: If logout occurred while pending, discard result
            if (sessionVersion !== currentVersion) {
                logger.warn('[API] Refresh discarded: global session version changed during request');
                return null;
            }

            if (!response.data.success || !response.data.data?.token) {
                logger.error('[API] Refresh failed: server returned success=false');
                throw new Error('Refresh response invalid or failed');
            }

            const { token: newToken, refreshToken: newRefreshToken } = response.data.data;
            
            // Phase 7: Atomic state update (Network + Memory + LocalStorage sync)
            setAccessToken(newToken);
            sessionStorage.setItem('token', newToken);
            if (newRefreshToken) sessionStorage.setItem('refreshToken', newRefreshToken);

            logger.info('[API] Token refresh successful. Informing subscribers.');
            processQueue(null, newToken);
            return newToken;
        } catch (err: unknown) {
            const isNetworkError = axios.isAxiosError(err) && (!err.response || err.code === 'ECONNABORTED');
            
            // Phase 10: Network Failure Resilience (Wait and Retry)
            if (isNetworkError && retryCount < 5 && sessionVersion === currentVersion) {
                const backoff = 1000 * Math.pow(2, retryCount);
                logger.warn(`[API] Refresh network error. Retrying (${retryCount + 1}/5) in ${backoff}ms...`);
                refreshPromise = null; 
                await new Promise(r => setTimeout(r, backoff));
                return performRefresh(retryCount + 1);
            }

            // Phase 6: Only clear session if we are still on same version AND it's a real Auth failure
            if (sessionVersion === currentVersion) {
                const isAuthError = axios.isAxiosError(err) && err.response && (err.response.status === 401 || err.response.status === 403);
                
                if (isAuthError) {
                    logger.error('[API] Sync refresh failed (Authentication Invalid). Terminating session.', err);
                    processQueue(err, null);
                    clearAuthSession();
                } else {
                    logger.warn('[API] Refresh network failure. Keeping local session but marking downstream as offline.', err);
                    processQueue(err, null);
                    // Do NOT clearAuthSession() here. The next heartbeat or visibility change will retry.
                }
            }
            return null;

        } finally {
            if (sessionVersion === currentVersion) {
                refreshPromise = null;
            }
        }
    })();

    return refreshPromise;
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
        if (!error.response) return Promise.reject(error);

        // 1. Interceptor Loop Protection
        if (originalRequest.url?.includes('/auth/refresh-token')) {
            if (error.response.status === 401) {
                clearAuthSession();
            }
            return Promise.reject(error);
        }

        // 2. Expected Auth Failures (Silent)
        const isExpectedAuthFailure =
            (error.response.status === 400 || error.response.status === 401 || error.response.status === 403) &&
            originalRequest.url?.includes('/auth/');

        if (isExpectedAuthFailure) {
            return Promise.reject({
                ...(error.response.data as object),
                status: error.response.status,
                _isSilent: true
            });
        }

        // 3. 401 Handling with Request Queuing
        if (error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            // Buffer this request in the failed queue
            return new Promise((resolve, reject) => {
                failedQueue.push({
                    resolve: (token: string | null) => {
                        if (token) {
                            if (originalRequest.headers) {
                                originalRequest.headers.Authorization = `Bearer ${token}`;
                            }
                            resolve(api(originalRequest));
                        } else {
                            reject(error);
                        }
                    },
                    reject: (err) => reject(err)
                });

                // Start refresh if not already in progress
                if (!refreshPromise) {
                    performRefresh();
                }
            });
        }

        // 4. Critical System Errors (500s)
        if (error.response.status >= 500) {
            const isRetryable = [502, 503, 429].includes(error.response.status);
            if (!isRetryable && typeof window !== 'undefined') {
                const now = Date.now();
                if (now - lastSystemErrorTime > 500) {
                    lastSystemErrorTime = now;
                    window.dispatchEvent(new CustomEvent('system:error', {
                        detail: {
                            message: 'A critical system error occurred.',
                            statusCode: error.response.status
                        }
                    }));
                }
            }
            if (!isRetryable) return Promise.reject(error);
        }

        // 5. 502/503/429 Retry Logic
        if (originalRequest.__retryCount === undefined) originalRequest.__retryCount = 0;
        const is500Retryable = error.response && (error.response.status === 502 || error.response.status === 503 || error.response.status === 429);

        if (originalRequest.__retryCount < MAX_RETRIES && is500Retryable) {
            originalRequest.__retryCount += 1;
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, originalRequest.__retryCount);
            await new Promise(resolve => setTimeout(resolve, delay));
            return api(originalRequest);
        }

        if (error.response.status === 403 && !originalRequest.url?.includes('/auth/')) {
            clearAuthSession();
        }

        return Promise.reject(error);
    }
);

export default api;
