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

// Custom interface for request configuration
interface ExtendedRequestConfig extends InternalAxiosRequestConfig {
    __cachedData?: unknown;
    __retryCount?: number;
    _retry?: boolean;
}

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 1000;

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

// ─── Native API Instance ───────────────────────────────────────────────────
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        ...(IS_DEMO_MODE ? { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' } : {}),
    },
    withCredentials: false,
    timeout: 10000,
});

// ─── Orchestration Engine ────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
    const checkBackendReady = async () => {
        try {
            const res = await axios.get(`${API_URL}/health/ready`, { timeout: 2000 });
            return res.data?.status === 'ready' || res.data?.status === 'ok';
        } catch {
            return false;
        }
    };

    const flushQueue = () => {
        logger.info(`[API] Orchestration complete. Flushing ${initializationQueue.length} buffered requests.`);
        appInitialized = true;
        
        const queueToProcess = [...initializationQueue];
        initializationQueue = [];
        
        queueToProcess.forEach(({ config, resolve, reject }) => {
            const token = accessToken || sessionStorage.getItem('token');
            if (token && config.headers) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            api(config).then(resolve).catch(reject);
        });
    };

    const orchestrateStartup = async () => {
        let backendReady = false;

        // Fail-safe: Ensure queue flushes within 3.5 seconds even if polling stalls
        const failSafe = setTimeout(() => {
            if (!appInitialized) {
                logger.warn('[API] Boot timeout. Forcing fail-safe queue flush.');
                flushQueue();
            }
        }, 3500);

        // Phase 1: Wait for backend readiness (5 attempts, 1s apart)
        let attempts = 0;
        while (!backendReady && attempts < 5) {
            logger.info(`[API] Checking backend readiness (Attempt ${attempts + 1})...`);
            backendReady = await checkBackendReady();
            if (!backendReady) {
                attempts++;
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        if (backendReady) {
            logger.info('[API] Backend readiness confirmed. Flushing orchestration queue.');
            flushQueue();
        } else {
            logger.warn('[API] Backend unreachable. Flushing queue anyway to allow offline UI state.');
            appInitialized = true;
            flushQueue();
        }
        clearTimeout(failSafe);
    };

    orchestrateStartup();
}

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

    // Phase 8: Exclude /auth/ from triggering circuit breaker
    const url = error.config?.url || '';
    if (url.includes('/auth/login') || url.includes('/auth/refresh-token')) {
        return;
    }

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

// ─── Phase 2, 5 & 6: Refresh Engine & Safety Guards (Enterprise Mutex) ────────
let lastSystemErrorTime = 0;
let isRefreshing = false;
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
    isRefreshing = false;
    
    // Phase 7: Atomic state clearing (Memory + Network + Storage)
    setAccessToken(null);
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
    
    // Deterministic Queue Cleanout
    processQueue(new Error('Session terminated'));
    
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
};

export const performRefresh = async (retryCount = 0): Promise<string | null> => {
    if (isRefreshing) {
        return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
        });
    }

    isRefreshing = true;
    const currentVersion = sessionVersion;

    try {
        const currentRefreshToken = sessionStorage.getItem('refreshToken');
        if (!currentRefreshToken) {
            logger.info('[API] No refresh token found. Draining queue.');
            processQueue(new Error('No active session'), null);
            isRefreshing = false;
            return null;
        }

        logger.info(`[API] Initiating synchronized token refresh (Attempt ${retryCount + 1})`);
        
        // Use direct axios to avoid interceptor loop
        const response = await axios.post<{ success?: boolean; code?: string, message?: string, data?: { token?: string, refreshToken?: string } }>(
            `${API_URL}/auth/refresh-token`,
            { refreshToken: currentRefreshToken },
            { timeout: 8000 }
        );

        // Phase 6 Safety: If logout occurred while pending, discard result
        if (sessionVersion !== currentVersion) {
            logger.warn('[API] Refresh discarded: logout occurred during request');
            isRefreshing = false;
            return null;
        }

        // Backend Fix ensures success: true OR 401 error.
        // We handle 200/true here.
        if (!response.data || !response.data.data?.token) {
            throw new Error('Refresh response invalid or failed');
        }

        const { token: newToken, refreshToken: newRefreshToken } = response.data.data;
        
        // Atomic state update
        setAccessToken(newToken);
        sessionStorage.setItem('token', newToken);
        if (newRefreshToken) sessionStorage.setItem('refreshToken', newRefreshToken);

        logger.info('[API] Token refresh successful');

        // 📢 Broadcast to other tabs for multi-tab sync
        if (typeof window !== 'undefined') {
            const base64Url = newToken.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const decoded = JSON.parse(atob(base64));
            const userId = decoded?.id;

            const syncChannel = new BroadcastChannel('haemi_auth_sync');
            syncChannel.postMessage({ 
                type: 'TOKEN_REFRESHED', 
                payload: { 
                    token: newToken, 
                    refreshToken: newRefreshToken, 
                    version: sessionVersion,
                    userId: userId 
                } 
            });
            syncChannel.close();
        }

        processQueue(null, newToken);
        isRefreshing = false;
        return newToken;
    } catch (err: unknown) {
        const isNetworkError = axios.isAxiosError(err) && (!err.response || err.code === 'ECONNABORTED');
        const isAuthError = axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403);
        
        // Network Failure Resilience (Exponential Backoff)
        if (isNetworkError && retryCount < 2 && sessionVersion === currentVersion) {
            const backoff = 1000 * Math.pow(2, retryCount);
            logger.warn(`[API] Refresh network error. Retrying in ${backoff}ms...`);
            isRefreshing = false;
            await new Promise(r => setTimeout(r, backoff));
            return performRefresh(retryCount + 1);
        }

        // Phase 6: Only clear session if we are still on the same session version
        if (sessionVersion === currentVersion) {
            if (isAuthError) {
                logger.info('[API] Session refresh unauthorized (Silent Failure Handling)');
            } else {
                logger.error('[API] Sync refresh failed permanently', err);
            }
            
            processQueue(err, null);
            clearAuthSession();
        }
        isRefreshing = false;
        return null;
    }
};

api.interceptors.response.use(
    async (response) => {
        // Standardize response unwrapping
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
        
        // 1. Interceptor Loop Protection
        if (originalRequest.url?.includes('/auth/refresh-token')) {
            if (error.response?.status === 401) {
                clearAuthSession();
            }
            return Promise.reject(error);
        }

        // 2. Expected Auth Failures (Silent)
        const isExpectedAuthFailure = error.response && 
            (error.response.status === 400 || error.response.status === 401 || error.response.status === 403) &&
            originalRequest.url?.includes('/auth/');

        if (isExpectedAuthFailure) {
            return Promise.reject({
                ...(error.response!.data as object),
                status: error.response!.status,
                _isSilent: true
            });
        }

        // 3. 401 Handling with Request Queuing System (Mutex Locked)
        if (error.response?.status === 401 && !originalRequest._retry) {
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
                performRefresh();
            });
        }

        // 4. Critical System Errors (500s)
        if (error.response && error.response.status >= 500) {
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

        if (error.response?.status === 403 && !originalRequest.url?.includes('/auth/')) {
            clearAuthSession();
        }

        return Promise.reject(error);
    }
);

export default api;
