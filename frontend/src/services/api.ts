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
};

export const getAccessToken = () => accessToken;

// ─── Request Buffer Logic (Resilience Engine) ────────────────────────────────
// Buffers requests made while the app is stabilizing (init or HMR)
let appInitialized = false;
let initializationQueue: {
    config: ExtendedRequestConfig;
    resolve: (value: any) => void;
    reject: (reason?: any) => void
}[] = [];

export const setAppInitialized = () => {
    appInitialized = true;
};

// Process the initialization queue once the AuthContext is ready
if (typeof window !== 'undefined') {
    window.addEventListener('auth:ready', () => {
        appInitialized = true;
        initializationQueue.forEach(({ config, resolve, reject }) => {
            // Re-inject token if it was missing during buffering
            if (accessToken && config.headers) {
                config.headers.Authorization = `Bearer ${accessToken}`;
            }
            api(config).then(resolve).catch(reject);
        });
        initializationQueue = [];
    });
}

// Cache for successful GET responses
const CACHE_KEY_PREFIX = 'haemi_api_cache_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Custom interface for request configuration with our metadata
interface ExtendedRequestConfig extends InternalAxiosRequestConfig {
    __cachedData?: unknown;
    __retryCount?: number;
    _retry?: boolean; // Standard axios retry flag
}

const SENSITIVE_ROUTE_PATTERNS = [
    '/auth/',
    '/admin/',
    '/records/',
    '/prescriptions/',
    '/chat/',
    '/notifications/',
    '/password-reset/',
];

function isSensitiveRoute(url: string | undefined): boolean {
    if (!url) return true;
    return SENSITIVE_ROUTE_PATTERNS.some(pattern => url.includes(pattern));
}

// Retry configuration
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 1000; // 1 second

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
        // Force no-cache headers in Demo Mode
        ...(IS_DEMO_MODE ? {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        } : {}),
    },
    withCredentials: true, // Ensure cookies are sent
    timeout: 10000, // 10 second timeout
});

// ─── Task 3: Basic Circuit Breaker (Frontend) ──────────────────────────────
// Prevents flooding a failing backend with requests.
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
let failureCount = 0;
let circuitState: CircuitState = 'CLOSED';
let nextTryTime = 0;
const FAILURE_THRESHOLD = 5;
const COOLDOWN_PERIOD = 10000; // 10 seconds

function checkCircuitBreaker(): boolean {
    if (circuitState === 'CLOSED') return true;

    if (circuitState === 'OPEN') {
        if (Date.now() >= nextTryTime) {
            circuitState = 'HALF_OPEN';
            console.warn('[Circuit] Entering HALF_OPEN state. Allowing test request...');
            return true;
        }
        return false;
    }

    // In HALF_OPEN, we only allow one request through
    return false;
}

function recordSuccess() {
    if (circuitState !== 'CLOSED') {
        console.info('[Circuit] Success detected. Closing circuit.');
    }
    failureCount = 0;
    circuitState = 'CLOSED';
}

function recordFailure(error: AxiosError) {
    // Only trigger on network errors, timeouts, or server-level 502/503
    const isNetworkError = !error.response || error.code === 'ECONNABORTED';
    const isServerOverloaded = error.response && (error.response.status === 502 || error.response.status === 503);

    if (!isNetworkError && !isServerOverloaded) return;

    failureCount++;
    if (failureCount >= FAILURE_THRESHOLD && circuitState !== 'OPEN') {
        circuitState = 'OPEN';
        nextTryTime = Date.now() + COOLDOWN_PERIOD;
        console.error(`[Circuit] ${FAILURE_THRESHOLD} failures detected. Circuit OPENED for ${COOLDOWN_PERIOD / 1000}s.`);
    } else if (circuitState === 'HALF_OPEN') {
        circuitState = 'OPEN';
        nextTryTime = Date.now() + COOLDOWN_PERIOD;
        console.error(`[Circuit] Half-open request failed. Re-opening circuit.`);
    }
}

// Exponential backoff delay calculation
function getRetryDelay(retryCount: number): number {
    return INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
}

// Check if error is retryable
function isRetryableError(error: AxiosError): boolean {
    if (!error.response) {
        // FATAL NETWORK DROP: Do not retry. Immediately fail gracefully.
        return false;
    }
    // Retry on 5xx server errors and 429 rate limit
    return error.response.status >= 500 || error.response.status === 429;
}

// Generate cache key from request config
function getCacheKey(config: AxiosRequestConfig): string {
    return `${config.method}:${config.url}:${JSON.stringify(config.params || {})}`;
}

// Check cache for valid response
function getFromCache(cacheKey: string, url?: string): any | null {
    if (IS_DEMO_MODE) return null;
    if (isSensitiveRoute(url)) return null;

    const storageKey = CACHE_KEY_PREFIX + btoa(cacheKey);
    const cachedStr = sessionStorage.getItem(storageKey);

    if (cachedStr) {
        try {
            const cached = JSON.parse(cachedStr);
            if (Date.now() - cached.timestamp < CACHE_DURATION) {
                return cached.data;
            } else {
                sessionStorage.removeItem(storageKey);
            }
        } catch (e) {
            sessionStorage.removeItem(storageKey);
        }
    }
    return null;
}

// Save response to cache
function saveToCache(cacheKey: string, data: any, url?: string): void {
    if (IS_DEMO_MODE) return;
    if (isSensitiveRoute(url)) return;

    const storageKey = CACHE_KEY_PREFIX + btoa(cacheKey);
    const cacheData = { data, timestamp: Date.now() };
    sessionStorage.setItem(storageKey, JSON.stringify(cacheData));
}

// Show toast notification for retry
function showRetryToast(retryCount: number, maxRetries: number): void {
    const event = new CustomEvent('showToast', {
        detail: {
            message: `Network issue - Retrying (${retryCount}/${maxRetries})...`,
            type: 'warning',
        },
    });
    window.dispatchEvent(event);
}

// Add a request interceptor to include the auth token
api.interceptors.request.use(
    (config: ExtendedRequestConfig) => {
        // Task 3: Circuit Breaker Gate
        if (!checkCircuitBreaker()) {
            return Promise.reject(new Error('Circuit is OPEN. Request blocked to prevent cascading failure.'));
        }

        // RESILIENCE GATE: If app is not initialized and route is sensitive, buffer it.
        // This prevents 401 logout loops during HMR or slow session boots.
        const isAuthRoute = config.url?.includes('/auth/');
        if (!appInitialized && !isAuthRoute) {
            return new Promise((resolve, reject) => {
                initializationQueue.push({ config, resolve, reject });
            }) as any;
        }

        // Use memory token
        if (accessToken && config.headers) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }

        // For GET requests, check cache (skip sensitive routes)
        if (config.method?.toLowerCase() === 'get') {
            const cacheKey = getCacheKey(config);
            const cachedData = getFromCache(cacheKey, config.url);
            if (cachedData) {
                config.__cachedData = cachedData;
            }
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Refresh Token State
let isRefreshing = false;
let failedQueue: any[] = [];

// ─── Session-Neutral Endpoints ───────────────────────────────────────────────
// These are DATA endpoints. A 401 from them means that specific request failed
// (e.g., transient backend issue, brief token invalidity for that route), NOT
// that the user's session is expired. Only /auth/refresh-token failing can prove
// the session is truly dead. These endpoints MUST NOT trigger clearAuthSession().
// This is a permanent architectural rule, not a workaround.
const SESSION_NEUTRAL_ENDPOINTS = ['/notifications', '/chat/messages', '/chat/'];

const isSessionNeutral = (url?: string): boolean =>
    !!url && SESSION_NEUTRAL_ENDPOINTS.some(p => url.includes(p));

// Session Management Helper
const clearAuthSession = () => {
    // Guard: Do not wipe session during app initialization.
    if (!appInitialized) return;
    isRefreshing = false;
    setAccessToken(null);
    sessionStorage.removeItem('user');
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
};

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};

// Enhanced response interceptor with retry logic and caching
api.interceptors.response.use(
    async (response) => {
        const config = response.config as ExtendedRequestConfig;

        // GLOBAL HARDENED API UNWRAPPER:
        // Automatically unwrap the standard backend format { success, message, data }
        // so that all frontend services (auth, appointments, prescriptions) receive the expected payload directly.
        if (response.data && typeof response.data === 'object' && 'success' in response.data && 'data' in response.data) {
            response.data = response.data.data;
        }

        // Task 3: Record circuit success
        recordSuccess();

        // If this was a GET request, save to cache
        if (config.method?.toLowerCase() === 'get' && response.data) {
            const cacheKey = getCacheKey(config);
            saveToCache(cacheKey, response.data, config.url);
        }

        return response;
    },
    async (error: AxiosError) => {
        const originalRequest = error.config as ExtendedRequestConfig;

        // Task 3: Record circuit failure
        recordFailure(error);

        if (!originalRequest) return Promise.reject(error);

        // Authentication Interceptor (Silent Refresh)
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (originalRequest.url?.includes('/auth/refresh-token')) {
                clearAuthSession();
                return Promise.reject(error);
            }

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
                const response = await axios.post<{ success?: boolean; data?: { token?: string } }>(
                    `${API_URL}/auth/refresh-token`,
                    {},
                    { withCredentials: true }
                );

                if (!response.data.success || !response.data.data?.token) {
                    throw new Error('Unauthenticated');
                }

                const token = response.data.data.token;
                setAccessToken(token);
                processQueue(null, token);
                isRefreshing = false;

                originalRequest.headers.Authorization = `Bearer ${token}`;
                return api(originalRequest);
            } catch (rawErr: any) {
                const err = rawErr as AxiosError;
                processQueue(err, null);
                isRefreshing = false;

                // CIRCUIT BREAKER: If AuthContext hasn't finished its own boot yet,
                // do NOT clear session. Let the initialization logic handle it.
                if (!appInitialized) return Promise.reject(err);

                // Session is truly expired ONLY when a core auth or data route fails,
                // the URL is not a session-neutral data endpoint, AND the server 
                // explicitly rejected the token (401/403). A network drop MUST NOT clear it.
                const isAuthRejection = err.response && (err.response.status === 401 || err.response.status === 403);
                const isCritical = !isSessionNeutral(originalRequest.url) && !originalRequest.url?.includes('/auth/me');

                if (isCritical && isAuthRejection) {
                    clearAuthSession();
                }
                return Promise.reject(err);
            }
        }

        // Initialize retry count
        if (originalRequest.__retryCount === undefined) {
            originalRequest.__retryCount = 0;
        }

        // Check if we should retry
        if (originalRequest.__retryCount >= MAX_RETRIES || !isRetryableError(error)) {
            // Check cache fallback
            if (originalRequest.method?.toLowerCase() === 'get') {
                const cacheKey = getCacheKey(originalRequest);
                const cachedData = getFromCache(cacheKey);
                if (cachedData) {
                    const event = new CustomEvent('showToast', {
                        detail: { message: 'Showing offline data', type: 'warning' },
                    });
                    window.dispatchEvent(event);
                    return Promise.resolve({ data: cachedData, status: 200, config: originalRequest });
                }
            }
            return Promise.reject(error);
        }

        // Increment retry count
        originalRequest.__retryCount += 1;

        // Show retry toast
        showRetryToast(originalRequest.__retryCount, MAX_RETRIES);

        // Wait before retrying
        const delay = getRetryDelay(originalRequest.__retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry the request
        return api(originalRequest);
    }
);

export default api;
