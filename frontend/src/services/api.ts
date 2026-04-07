import axios, { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { logger, auditLogger, intrusionDetector } from '../utils/logger';
import { NetworkError, AuthError, RefreshFailureError, FatalAuthError, isAuthError, isNetworkError } from '../types/auth.types';
import type { AuthResponse, ApiResponse } from '../types/auth.types';
import { isJWTPayload, safeParseJSON } from '../utils/type-guards';

const BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '';
const API_URL = BASE_URL ? `${BASE_URL}/api` : '/api';

if (API_URL.includes('/api/api')) {
  throw new Error('Invalid API base URL configuration');
}

// DEMO MODE FLAG
const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

// Memory Token Storage (Closure)
let accessToken: string | null = null;

export const setAccessToken = (token: string | null, refreshToken?: string | null, serverTime?: string, sessionTimeout?: number) => {
    // Phase 9: Enforce Idempotency & Event Dispatch Guard
    if (accessToken === token) return;

    accessToken = token;
    
    // Phase 7: Atomic Network Layer Sync
    if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        delete api.defaults.headers.common['Authorization'];
    }

    if (typeof window !== 'undefined' && token) {
        window.dispatchEvent(new CustomEvent('auth:token-refreshed', { 
            detail: { token, refreshToken, serverTime, sessionTimeout } 
        }));
    }
};

export const getAccessToken = () => accessToken;

interface ExtendedRequestConfig extends InternalAxiosRequestConfig {
    __cachedData?: unknown;
    __retryCount?: number;
    _retry?: boolean;
}

function isExtendedConfig(config: unknown): config is ExtendedRequestConfig {
    return !!config && typeof config === 'object';
}

interface ErrorResponseData {
    message?: string;
}

function isErrorResponseData(data: unknown): data is ErrorResponseData {
    return !!data && typeof data === 'object';
}

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 1000;

// ─── Request Buffer Logic (Resilience Engine) ────────────────────────────────
let appInitialized = false;
let initializationQueue: {
    config: ExtendedRequestConfig;
    resolve: (config: InternalAxiosRequestConfig) => void;
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
    timeout: 30000, // Phase 1: Institutional Hardening — Increased to 30s to prevent historical load failure
});

// ─── Phase 10: Refresh Client (Dual Axios System) ──────────────────────────
const refreshClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: false,
    timeout: 8000,
});

// ─── Centralized Response Normalization ────────────────────────────────────
export const normalizeResponse = <T>(
    response: AxiosResponse<ApiResponse<T>>
): T => {
    // P0 FIX: Bypass normalization for BINARY (blob) or /files/ endpoints
    const isBinary = response.config.responseType === 'blob' || 
                     response.config.url?.includes('/files/');
    
    if (isBinary) {
        if (!(response.data instanceof Blob) && response.config.responseType === 'blob') {
            throw new Error('Expected Blob response for binary endpoint');
        }
        return response.data as T;
    }

    if (
        typeof response.data !== 'object' ||
        response.data === null ||
        !('success' in response.data) ||
        !('data' in response.data)
    ) {
        throw new Error('Invalid API response structure');
    }

    return response.data.data;
};

// ─── Orchestration Engine ────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
    const checkBackendReady = async () => {
        try {
            const res = await axios.get(`${API_URL}/health/ready`, { timeout: 2000 });
            return res.data?.status === 'ready' || res.data?.status === 'ok';
        } catch (error: unknown) {
            auditLogger.log('UNHANDLED_ERROR', {
                message: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    };

    const flushQueue = () => {
        logger.info(`[API] Orchestration complete. Flushing ${initializationQueue.length} buffered requests.`);
        appInitialized = true;
        
        const queueToProcess = [...initializationQueue];
        initializationQueue = [];
        
        queueToProcess.forEach(({ config, resolve }) => {
            const token = accessToken || sessionStorage.getItem('token');
            if (token && config.headers) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            resolve(config);
        });
    };

    const orchestrateStartup = async () => {
        try {
            // Phase 1: Native single-shot check
            const isBackendReady = await checkBackendReady();
            if (isBackendReady) {
                logger.info('[API] Backend confirmed ready. Flushing queue.');
            } else {
                logger.warn('[API] Backend unreachable or not ready. Proceeding to flush queue for offline state.');
            }
        } catch (error: unknown) {
            logger.error('[API] Orchestration call failed.', error instanceof Error ? error.message : String(error));
        } finally {
            flushQueue();
        }
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

function recordFailure(error: AxiosError<ApiResponse<unknown>>) {
    const isNetErr = !error.response || error.code === 'ECONNABORTED';
    const isServerOverloaded = error.response && (error.response.status === 502 || error.response.status === 503);
    if (!isNetErr && !isServerOverloaded) return;

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
            return Promise.reject(new NetworkError('Circuit is OPEN.'));
        }

        const isDiscoveryRoute = config.url?.includes('/auth/') ||
            config.url?.includes('/health/') ||
            config.url?.includes('/profiles/me');

        // Phase 6 Hardening: /profiles/me is allowed to bypass initialization queue 
        // specifically to permit AuthProvider to resolve the boot state.
        if (!appInitialized && !isDiscoveryRoute) {
            return new Promise((resolve, reject) => {
                initializationQueue.push({ config, resolve, reject });
            });
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
    (error: unknown) => Promise.reject(error instanceof Error ? error : new Error(String(error)))
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
    localStorage.removeItem('token'); // Phase 2: Ultimate purge guarantee
    
    // Deterministic Queue Cleanout
    processQueue(new FatalAuthError('Session terminated'));
    
    auditLogger.log('LOGOUT', { reason: 'clearAuthSession invoked' });

    // Broadcast cross-tab kill-switch safely
    if (typeof window !== 'undefined') {
        try {
            const syncChannel = new BroadcastChannel('haemi_auth_sync');
            syncChannel.postMessage({ type: 'HARD_LOGOUT', payload: { version: sessionVersion } });
            syncChannel.close();
        } catch (error: unknown) {
            const errMessage = error instanceof Error ? error.message : String(error);
            auditLogger.log('UNHANDLED_ERROR', { message: errMessage });
            /* ignore */
        }
    }
    
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
            processQueue(new FatalAuthError('No active session'), null);
            isRefreshing = false;
            return null;
        }

        logger.info(`[API] Initiating synchronized token refresh (Attempt ${retryCount + 1})`);
        
        // Use isolated refreshClient (safe from interceptor loops, but shares normalization)
        const rawResponse = await refreshClient.post<ApiResponse<AuthResponse>>(
            `/auth/refresh-token`,
            { refreshToken: currentRefreshToken }
        );

        const refreshData = normalizeResponse(rawResponse);
        if (!refreshData || !refreshData.token) {
            throw new RefreshFailureError('Refresh response invalid or missing token');
        }

        // Phase 6 Safety: If logout occurred while pending, discard result
        if (sessionVersion !== currentVersion) {
            logger.warn('[API] Refresh discarded: logout occurred during request');
            isRefreshing = false;
            return null;
        }

        // Atomic state update
        const { token: newToken, refreshToken: newRefreshToken, serverTime, sessionTimeout } = refreshData;
        
        setAccessToken(newToken, newRefreshToken, serverTime, sessionTimeout);
        sessionStorage.setItem('token', newToken);
        if (newRefreshToken) sessionStorage.setItem('refreshToken', newRefreshToken);

        logger.info('[API] Token refresh successful');
        auditLogger.log('TOKEN_REFRESH_SUCCESS');

        // 📢 Broadcast to other tabs for multi-tab sync
        if (typeof window !== 'undefined') {
            try {
                const base64Url = newToken.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const decodedToken = safeParseJSON(atob(base64), isJWTPayload);
                const userId = decodedToken?.id;

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
            } catch (error) {
                const errMessage = error instanceof Error ? error.message : 'Unknown error';
                auditLogger.log('ERROR', { message: errMessage });
                logger.error('[API] BroadcastChannel sync failed dynamically. Insulated from auth flow.', error);
            }
        }

        processQueue(null, newToken);
        isRefreshing = false;
        return newToken;
    } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : 'Unknown error';
        auditLogger.log('ERROR', { message: errMessage });
        // Type-Safe Error Narrowing
        const isNetworkErr = (axios.isAxiosError(error) && (!error.response || error.code === 'ECONNABORTED')) || isNetworkError(error);
        const isAuthErr = (axios.isAxiosError(error) && error.response?.status === 401) || isAuthError(error); // 403 is NOT an auth failure, it is Forbidden
        
        // Network Failure Resilience (Exponential Backoff + Jitter)
        if (isNetworkErr && retryCount < 2 && sessionVersion === currentVersion) {
            const baseBackoff = 1000 * Math.pow(2, retryCount);
            const jitter = Math.floor(Math.random() * 500); // 0-500ms random jitter
            const backoff = Math.min(baseBackoff + jitter, 5000); // Bounded max retry wait
            
            logger.warn(`[API] Refresh network error. Retrying in ${backoff}ms...`);
            isRefreshing = false;
            await new Promise(r => setTimeout(r, backoff));
            return performRefresh(retryCount + 1);
        }

        // Phase 6: Only clear session if we are still on the same session version
        if (sessionVersion === currentVersion) {
            if (isAuthErr) {
                logger.info('[API] Session refresh unauthorized (TERMINAL REJECTION)');
                auditLogger.log('UNAUTHORIZED_EVENT', { reason: 'Refresh token rejected' });
                
                // CRITICAL P0 FIX: If refresh token is explicitly rejected, we MUST clear the session
                // to prevent infinite interceptor loops that DOS the backend connection pool.
                clearAuthSession();
            } else {
                logger.error('[API] Sync refresh failed permanently', error);
                auditLogger.log('TOKEN_REFRESH_FAILURE', { reason: error instanceof Error ? error.message : 'Unknown' });
                intrusionDetector.trackFailure('refresh');
            }
            
            // Format strict error before rejecting queue
            const strictErr = error instanceof Error ? error : new RefreshFailureError('Unknown refresh failure');
            processQueue(strictErr, null);
        }
        isRefreshing = false;
        return null;
    }
};

api.interceptors.response.use(
    async (response) => {
        // Phase 11: Normalization shifted to individual services for safe contract migration.
        recordSuccess();
        return response;
    },
    async (error: AxiosError<ApiResponse<unknown>>) => {
        const originalRequest = error.config;
        recordFailure(error);

        if (!isExtendedConfig(originalRequest)) return Promise.reject(error);
        
        // 1. Interceptor Loop Protection
        if (originalRequest.url?.includes('/auth/refresh-token')) {
            if (error.response?.status === 401) {
                // PHASE 1 FIX: Only reject — DO NOT logout here to prevent forced logout on hard refresh
                return Promise.reject(new AuthError('Refresh token invalid', error.response?.status));
            }
            return Promise.reject(new AuthError('Refresh token invalid', error.response?.status));
        }

        // 2. Expected Auth Failures (Silent)
        const isExpectedAuthFailure = error.response && 
            (error.response.status === 400 || error.response.status === 401) &&
            originalRequest.url?.includes('/auth/');

        if (isExpectedAuthFailure && error.response) {
            const data = error.response.data;
            const msg = isErrorResponseData(data) ? data.message || error.message : error.message;
            return Promise.reject(new AuthError(msg, error.response.status));
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

        // 5. 502/503/429 Retry Logic (Excluding 429 from auto-retry)
        if (error.response?.status === 429) {
            logger.warn('[API] Rate limit reached. Rejecting without retry.');
            return Promise.reject(error);
        }

        if (originalRequest.__retryCount === undefined) originalRequest.__retryCount = 0;
        const is500Retryable = error.response && (error.response.status === 502 || error.response.status === 503);

        if (originalRequest.__retryCount < MAX_RETRIES && is500Retryable) {
            originalRequest.__retryCount += 1;
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, originalRequest.__retryCount);
            await new Promise(resolve => setTimeout(resolve, delay));
            return api(originalRequest);
        }

        if (error.response?.status === 403) {
            // Institutional Hardening: Only clear session on 403 if we actually have a session to clear.
            // This prevents boot-time redirect loops in E2E tests for unauthenticated probes.
            if (accessToken) {
                logger.warn('[API] Forbidden access detected on authenticated session. Executing security logout.');
                clearAuthSession();
            } else {
                logger.error('[API] Forbidden access (403) on unauthenticated request.', { url: originalRequest.url });
            }
        }

        return Promise.reject(error);
    }
);

export default api;
