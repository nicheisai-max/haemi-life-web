import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';

const API_URL = 'http://localhost:5000'; // Adjust if backend runs on different port

// DEMO MODE FLAG
// @ts-ignore
const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

// Cache for successful GET responses
const CACHE_KEY_PREFIX = 'haemi_api_cache_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
function getFromCache(cacheKey: string): any | null {
    // BYPASS CACHE IN DEMO MODE
    if (IS_DEMO_MODE) return null;

    const storageKey = CACHE_KEY_PREFIX + btoa(cacheKey);
    const cachedStr = localStorage.getItem(storageKey);

    if (cachedStr) {
        try {
            const cached = JSON.parse(cachedStr);
            if (Date.now() - cached.timestamp < CACHE_DURATION) {
                return cached.data;
            } else {
                // Remove expired cache
                localStorage.removeItem(storageKey);
            }
        } catch (e) {
            localStorage.removeItem(storageKey);
        }
    }
    return null;
}

// Save response to cache
function saveToCache(cacheKey: string, data: any): void {
    // DISABLE CACHE WRITE IN DEMO MODE
    if (IS_DEMO_MODE) return;

    const storageKey = CACHE_KEY_PREFIX + btoa(cacheKey);
    const cacheData = {
        data,
        timestamp: Date.now(),
    };
    localStorage.setItem(storageKey, JSON.stringify(cacheData));
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
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // For GET requests, check cache
        if (config.method?.toLowerCase() === 'get') {
            const cacheKey = getCacheKey(config);
            const cachedData = getFromCache(cacheKey);
            if (cachedData) {
                // If we want to return from cache immediately, we'd need to cancel the request
                // but Axios interceptors aren't designed for "bypass and return".
                // Instead, we mark it to be handled in the response interceptor if the request fails.
                (config as any).__cachedData = cachedData;
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
    (response: AxiosResponse) => {
        // Cache successful GET requests
        if (response.config.method?.toLowerCase() === 'get') {
            const cacheKey = getCacheKey(response.config);
            saveToCache(cacheKey, response.data);
        }
        return response;
    },
    async (error: AxiosError) => {
        const config: any = error.config;

        // Handle 401 auth errors
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
            return Promise.reject(error);
        }

        // Initialize retry count
        if (!config.__retryCount) {
            config.__retryCount = 0;
        }

        // Check if we should retry
        if (config.__retryCount >= MAX_RETRIES || !isRetryableError(error)) {
            // Max retries reached or non-retryable error
            // Try to serve from cache for GET requests
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
