import axios, { AxiosError, type InternalAxiosRequestConfig, type AxiosRequestConfig } from 'axios';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api';

// DEMO MODE FLAG
// @ts-ignore
const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

// Memory Token Storage (Closure)
let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
    accessToken = token;
};

export const getAccessToken = () => accessToken;

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

// Exponential backoff delay calculation
function getRetryDelay(retryCount: number): number {
    return INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
}

// Check if error is retryable
function isRetryableError(error: AxiosError): boolean {
    if (!error.response) {
        return true; // Network errors
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

// Session Management Helper
const clearAuthSession = () => {
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

        // If this was a GET request, save to cache
        if (config.method?.toLowerCase() === 'get' && response.data) {
            const cacheKey = getCacheKey(config);
            saveToCache(cacheKey, response.data, config.url);
        }

        return response;
    },
    async (error: AxiosError) => {
        const originalRequest = error.config as ExtendedRequestConfig;

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
                const response = await axios.post<{ authenticated: boolean; token?: string }>(
                    `${API_URL}/auth/refresh-token`,
                    {},
                    { withCredentials: true }
                );

                if (!response.data.authenticated || !response.data.token) {
                    throw new Error('Unauthenticated');
                }

                const { token } = response.data;
                setAccessToken(token);
                processQueue(null, token);
                isRefreshing = false;

                originalRequest.headers.Authorization = `Bearer ${token}`;
                return api(originalRequest);
            } catch (err) {
                processQueue(err, null);
                // Fail-safe: Only clear session if this wasn't an intentional discovery attempt
                if (!originalRequest.url?.includes('/auth/me')) {
                    clearAuthSession();
                } else {
                    isRefreshing = false;
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
