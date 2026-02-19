import axios, { AxiosError, type InternalAxiosRequestConfig, type AxiosRequestConfig } from 'axios';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api';

// DEMO MODE FLAG
// @ts-ignore
const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

// Cache for successful GET responses
const CACHE_KEY_PREFIX = 'haemi_api_cache_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Custom interface for request configuration with our metadata
interface ExtendedRequestConfig extends InternalAxiosRequestConfig {
    __requestToken?: string | null;
    __cachedData?: unknown;
    __retryCount?: number;
}

// V11 FIX: Routes that must NEVER be cached in sessionStorage.
// These contain PHI (Protected Health Information), auth tokens, or sensitive
// admin data. Caching them in sessionStorage risks exposure via XSS or shared devices.
const SENSITIVE_ROUTE_PATTERNS = [
    '/auth/',
    '/admin/',
    '/records/',
    '/prescriptions/',
    '/chat/',
    '/notifications/',
    '/password-reset/',
];

// Flag to prevent multiple unauthorized events from firing simultaneously
let isResetting = false;

function isSensitiveRoute(url: string | undefined): boolean {
    if (!url) return true; // Default to sensitive if URL unknown
    return SENSITIVE_ROUTE_PATTERNS.some(pattern => url.includes(pattern));
}

// Retry configuration
const MAX_RETRIES = 3;
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
    timeout: 10000, // 10 second timeout
});

// Exponential backoff delay calculation
function getRetryDelay(retryCount: number): number {
    return INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
}

// Check if error is retryable
function isRetryableError(error: AxiosError): boolean {
    if (!error.response) {
        // Network errors, timeouts
        return true;
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
    // BYPASS CACHE IN DEMO MODE
    if (IS_DEMO_MODE) return null;
    // V11: Never cache sensitive routes
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
    // DISABLE CACHE WRITE IN DEMO MODE
    if (IS_DEMO_MODE) return;
    // V11: Never cache sensitive routes
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
        const token = sessionStorage.getItem('token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // CRITICAL: Stamp the token used for THIS request onto the config.
        // This allows the response interceptor to identify which token caused
        // a 401 — even if sessionStorage has been updated by a concurrent login.
        config.__requestToken = token || null;

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
        const config = error.config as ExtendedRequestConfig | undefined;

        if (!config) return Promise.reject(error);

        // 1. Handle 401 Unauthorized
        if (error.response && error.response.status === 401) {
            const requestToken = config.__requestToken || null;
            const currentToken = sessionStorage.getItem('token');

            // CRITICAL ENTERPRISE FIX: Scoped Token Rejection
            // If the 401 response came from a request that was sent with a token 
            // different from the current one, ignore it. This prevents ghost 
            // rejections from stale in-flight requests during a new login transition.
            if (requestToken && requestToken !== currentToken) {
                console.warn('[API] Ignoring 401 for stale/mismatched token. New session preserved.');
                return Promise.reject(error);
            }

            // If we're already resetting, ignore concurrent triggers.
            if (isResetting) {
                return Promise.reject(error);
            }

            isResetting = true;
            console.log('[API] Unauthorized detected for current session. Triggering state reset.');

            window.dispatchEvent(new CustomEvent('auth:unauthorized', {
                detail: { token: requestToken }
            }));

            // Clear local storage immediately
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');

            // Reset flag after a delay to allow UI to settle and redirects to happen
            setTimeout(() => { isResetting = false; }, 2000);

            return Promise.reject(error);
        }

        // Initialize retry count
        if (config.__retryCount === undefined) {
            config.__retryCount = 0;
        }

        // Check if we should retry
        if (config.__retryCount >= MAX_RETRIES || !isRetryableError(error)) {
            if (config.method?.toLowerCase() === 'get') {
                const cacheKey = getCacheKey(config);
                const cachedData = getFromCache(cacheKey);
                if (cachedData) {
                    const event = new CustomEvent('showToast', {
                        detail: { message: 'Showing offline data', type: 'warning' },
                    });
                    window.dispatchEvent(event);
                    return Promise.resolve({ data: cachedData, status: 200, config });
                }
            }
            return Promise.reject(error);
        }

        // Increment retry count
        config.__retryCount += 1;

        // Show retry toast
        showRetryToast(config.__retryCount, MAX_RETRIES);

        // Wait before retrying (exponential backoff)
        const delay = getRetryDelay(config.__retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry the request
        return api(config);
    }
);

export default api;
