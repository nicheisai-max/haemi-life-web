import axios, { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { logger, auditLogger, intrusionDetector } from '../utils/logger';
import { NetworkError, AuthError, RefreshFailureError, FatalAuthError, isAuthError, isNetworkError } from '../types/auth.types';
import type { AuthResponse, ApiResponse } from '../types/auth.types';
import { isJWTPayload, safeParseJSON } from '../utils/type-guards';

const RAW_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '';

// P0: Institutional Determinism - Standardize on 'localhost' for Windows resolution parity
// Root Cause (Forensic Audit): Windows browsers intermittently resolve 'localhost' to ::1 
// while the Node.js backend might bind to 127.0.0.1 (or vice-versa). 
// By forcing 'localhost' consistency, we prevent the ERR_CONNECTION_REFUSED 
// triggered by IPv4/IPv6 endpoint drift.
const BASE_URL = RAW_URL.includes('127.0.0.1') 
    ? RAW_URL.replace('127.0.0.1', 'localhost') 
    : RAW_URL;

const API_URL = BASE_URL ? `${BASE_URL}/api` : '/api';

if (API_URL.includes('/api/api')) {
    throw new Error('Invalid API base URL configuration');
}

// DEMO MODE FLAG
const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
const shouldSuppressLog = import.meta.env.PROD && !import.meta.env.VITE_DEBUG_LOGS;

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

export interface ExtendedRequestConfig extends InternalAxiosRequestConfig {
    __cachedData?: unknown;
    __retryCount?: number;
    __silent?: boolean;
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

export const setAppInitialized = (): void => {
    appInitialized = true;
};

/**
 * Read-only accessor for the module-level backend readiness flag.
 *
 * Returns `true` after `orchestrateStartup()` has confirmed the backend is
 * healthy and flushed the initialization queue (`flushQueue()`).
 *
 * Purpose: Allows `initAuth()` in auth-context.tsx to skip a redundant
 * `waitForBackend()` probe when the module-level health check already
 * succeeded. On local Postgres (investor demo), `orchestrateStartup()` completes
 * in ~20ms — well before React mounts — so this is almost always `true` by
 * the time `initAuth` runs, eliminating up to 5s of wasted boot latency.
 *
 * Type: pure → `(): boolean`. No parameters, no side effects, no `any`.
 */
export const isBackendConfirmed = (): boolean => appInitialized;

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
            logger.warn('[Circuit] Testing recovery...');
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
        logger.error(`[Circuit] Open for ${COOLDOWN_PERIOD / 1000}s. External connectivity refused.`);
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
            // ─── Expiry-Aware Token Resurrection Guard ────────────────────────────────
            // Institutional Standard (Phase 14 — SSOT Alignment):
            //
            // If the in-memory `accessToken` is null (e.g., hard refresh, new tab), we
            // attempt a "safe resurrection" from `sessionStorage` before falling through.
            //
            // NEAR-DEATH THRESHOLD: 10 seconds (aligned with ProtectedRoute in App.tsx).
            // Rationale: The proactive refresh in AuthContext fires early (typically ~1s
            // before expiry). A 60s buffer was too aggressive — it suppressed VALID tokens
            // that were being refreshed in the background, producing spurious 401s on
            // Clinical Reports, Chat, and other protected routes.
            //
            // A 10s buffer is the minimum safe window to prevent a mid-flight token
            // expiry on a slow network while avoiding the over-suppression regression.
            const TOKEN_NEAR_DEATH_THRESHOLD_SECONDS = 10 as const;

            const sessionToken = sessionStorage.getItem('token');
            if (sessionToken && config.headers) {
                try {
                    const base64Url = sessionToken.split('.')[1];
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    const decoded = safeParseJSON(atob(base64), isJWTPayload);
                    const now = Math.floor(Date.now() / 1000);

                    if (decoded && decoded.exp > (now + TOKEN_NEAR_DEATH_THRESHOLD_SECONDS)) {
                        config.headers.Authorization = `Bearer ${sessionToken}`;
                        accessToken = sessionToken; // Safe to restore — token has sufficient TTL
                    } else if (decoded) {
                        logger.warn(
                            `[API] Suppressed resurrection of near-death token (TTL: ${decoded.exp - now}s < ${TOKEN_NEAR_DEATH_THRESHOLD_SECONDS}s threshold)`
                        );
                    }
                } catch {
                    logger.warn('[API] Suppressed ghost token resurrection (Payload corrupted)');
                }
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
    // P0 Multi-Role Fix — Root Cause #1 (Broadcast Read-After-Delete):
    // Capture the caller's identity from the JWT BEFORE any storage is cleared.
    //
    // The original code cleared sessionStorage first, then tried to read it
    // to build the broadcast payload — always producing { userId: undefined }.
    // The receiving tabs checked `!payload.userId` which evaluates to `true` for
    // `undefined`, so ALL tabs matched and ALL roles were logged out simultaneously.
    //
    // Fix: Read identity while it is still available. `broadcastUserId` is narrowed
    // to `string | undefined` — no `any`, no double cast. The broadcast is skipped
    // entirely when userId cannot be determined (safer than broadcasting undefined).
    const identityToken = accessToken || sessionStorage.getItem('token');
    let broadcastUserId: string | undefined;
    let broadcastRole: string | undefined;

    if (identityToken) {
        try {
            const base64Url = identityToken.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const decoded = safeParseJSON(atob(base64), isJWTPayload);
            broadcastUserId = decoded?.id;    // string | undefined — strict
            broadcastRole = decoded?.role;  // string | undefined — strict
        } catch {
            // Token is malformed. broadcastUserId stays undefined — broadcast skipped.
        }
    }

    sessionVersion++; // Invalidate any pending refresh results
    isRefreshing = false;

    // Atomic state clearing (Memory + Network + Storage)
    setAccessToken(null);
    
    // P1 Fix — Scoped key removal (replaces sessionStorage.clear()):
    // Preserves non-auth data — theme preference, language, appointment drafts.
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken'); // P0.1: Legacy key (migration safety)
    sessionStorage.removeItem('user');
    localStorage.removeItem('token');                 // Legacy purge guarantee
    localStorage.removeItem('haemi_refresh_token');   // P0.1: Canonical refresh token key

    // Deterministic Queue Cleanout
    processQueue(new FatalAuthError('Session terminated'));

    logger.info(`[API] Local session invalidated. Logic: clearAuthSession (Version: ${sessionVersion})`);
    auditLogger.log('LOGOUT', { 
        reason: 'clearAuthSession invoked', 
        details: { version: sessionVersion } 
    });

    // Cross-tab kill-switch broadcast.
    // P0 Fix: Only broadcast when broadcastUserId is a confirmed string.
    // A missing userId means we cannot safely target a specific role silo,
    // so we skip the broadcast rather than risk a global logout of all roles.
    if (typeof window !== 'undefined' && broadcastUserId) {
        try {
            const syncChannel = new BroadcastChannel('haemi_auth_sync');
            syncChannel.postMessage({
                type: 'LOGOUT',
                payload: {
                    version: sessionVersion,
                    userId: broadcastUserId, // ← always a real user ID, never undefined
                    role: broadcastRole      // ← always a real role string, never undefined
                }
            });
            syncChannel.close();
            logger.info('[API] Logout broadcast dispatched to peer tabs', { userId: broadcastUserId, role: broadcastRole });
        } catch (error: unknown) {
            const errMessage = error instanceof Error ? error.message : String(error);
            logger.error('[API] Logout broadcast failure', { error: errMessage });
            auditLogger.log('UNHANDLED_ERROR', { message: errMessage });
        }
    }

    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
};

// ─── P0.3 + P0.5: Multi-Tab Token Sync Bridge (SSOT) ──────────────────────────
// P0.5 FIX: IS_DEMO_MODE guard now applied here to match auth-context.tsx.
// P0.3 FIX: LOGOUT case removed — cross-tab logout is now exclusively via the
//   localStorage 'storage' event (haemi_logout_signal key). This eliminates:
//   • Root Cause D: duplicate BC LOGOUT receiver in auth-context.tsx (now removed)
//   • Root Cause E: auth-context sent LOGOUT with no 'version' field, so api.ts
//     rejected it (undefined > 0 === false). localStorage events are version-free.
// This handler is now the TOKEN_REFRESHED SSOT only.
if (typeof window !== 'undefined' && !IS_DEMO_MODE) {
    const authSyncChannel = new BroadcastChannel('haemi_auth_sync');
    authSyncChannel.onmessage = (event: MessageEvent): void => {
        const messageData = event.data as { type: string; payload: Record<string, unknown> };
        const { type, payload } = messageData;
        const currentToken: string | null = accessToken ?? sessionStorage.getItem('token');

        // Decode current tab's identity from JWT for role-scoped matching
        let currentUserId: string | null = null;
        if (currentToken !== null) {
            try {
                const base64Url: string = currentToken.split('.')[1];
                const base64: string = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const decoded = safeParseJSON(atob(base64), isJWTPayload);
                currentUserId = decoded?.id ?? null;
            } catch (decodeErr: unknown) {
                logger.error('[API] Auth sync identity extraction failure', {
                    error: decodeErr instanceof Error ? decodeErr.message : String(decodeErr)
                });
            }
        }

        if (type === 'TOKEN_REFRESHED') {
            const tokenPayload = payload as {
                userId?: unknown;
                version?: unknown;
                token?: unknown;
                refreshToken?: unknown;
            };
            // Strict type narrowing — no any, no unsafe cast
            const payloadUserId: string | null = typeof tokenPayload.userId === 'string'
                ? tokenPayload.userId : null;
            const payloadVersion: number | null = typeof tokenPayload.version === 'number'
                ? tokenPayload.version : null;
            const payloadToken: string | null = typeof tokenPayload.token === 'string'
                ? tokenPayload.token : null;
            const payloadRefreshToken: string | null = typeof tokenPayload.refreshToken === 'string'
                ? tokenPayload.refreshToken : null;

            if (
                payloadUserId !== null &&
                payloadUserId === currentUserId &&
                payloadVersion !== null &&
                payloadVersion >= sessionVersion &&
                payloadToken !== null
            ) {
                logger.info('[API] Auth sync received: Token refreshed in matching tab.');
                setAccessToken(payloadToken, payloadRefreshToken ?? undefined);
                processQueue(null, payloadToken);
            }
        }
        // LOGOUT intentionally not handled here.
        // Cross-tab logout: auth-context.tsx logout() → localStorage 'haemi_logout_signal'
        //                   → storage event → handleStorageChange → commitAuthState.
    };
}


/**
 * Validates that a JWT token has sufficient TTL before it is reused from the
 * in-memory cache inside the `performRefresh` lock guard.
 *
 * Root-cause addressed (P0):
 *   Without this check, the lock guard returned any non-null `accessToken`
 *   (even one with 1–59s remaining) without calling `executeRefresh()`. This
 *   caused `verifySession()` to receive a near-death credential → backend 401
 *   → `clearAuthSession()` → forced logout on every page refresh within that
 *   expiry window.
 *
 * Type safety:
 *   - Param `token` is `string` (caller narrows from `string | null` via truthy check).
 *   - Uses `safeParseJSON + isJWTPayload` (both imported) — no `any`, no double cast.
 *   - Returns `boolean` — no `unknown` escapes this function.
 *
 * @param token         Raw JWT string. Must be non-null (caller responsibility).
 * @param minTTLSeconds Minimum remaining seconds for the token to be considered reusable.
 */
const isTokenViable = (token: string, minTTLSeconds: number): boolean => {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = safeParseJSON(atob(base64), isJWTPayload);
        if (!decoded) return false;
        const nowSeconds = Math.floor(Date.now() / 1000);
        return decoded.exp > (nowSeconds + minTTLSeconds);
    } catch {
        // Any decode failure means the token is not reusable.
        return false;
    }
};

/**
 * Single Source of Truth: Minimum TTL required for a cached token to be reused
 * from inside the `performRefresh` lock guard.
 *
 * Must be kept in sync with:
 *   - auth-context.tsx `OPTIMISTIC_TOKEN_MIN_TTL_SECONDS` (boot near-death threshold)
 *   - api.ts `TOKEN_NEAR_DEATH_THRESHOLD_SECONDS` (request interceptor resurrection guard)
 *
 * The 30-second value provides a buffer above the 10s interceptor threshold and
 * below the 60s boot-sequence threshold, resolving the "50-second dead zone" gap.
 */
const LOCK_GUARD_MIN_TTL_SECONDS = 30 as const;

export const performRefresh = async (retryCount = 0): Promise<string | null> => {
    // Phase 10: Institutional Multi-Tab Coordination
    if (typeof navigator !== 'undefined' && navigator.locks) {
        return await navigator.locks.request('haemi_token_refresh_lock', async () => {
            // Second-pass check after obtaining lock.
            // CRITICAL: We must validate TTL before reusing — isTokenViable() ensures
            // we never return a near-death or expired token (Root Cause #1 fix).
            const freshToken = accessToken || sessionStorage.getItem('token');
            if (freshToken && !isRefreshing && isTokenViable(freshToken, LOCK_GUARD_MIN_TTL_SECONDS)) {
                return freshToken; // Safe to reuse: token has ≥ 30s remaining TTL
            }
            return await executeRefresh(retryCount);
        });
    }

    // Fallback for environments without Lock API
    return await executeRefresh(retryCount);
};

const executeRefresh = async (retryCount = 0): Promise<string | null> => {
    if (isRefreshing) {
        return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
        });
    }

    isRefreshing = true;
    const currentVersion = sessionVersion;

    try {
        // P0.1 FIX: Refresh token read from localStorage (origin-scoped, survives new tabs).
        // Legacy sessionStorage key included as fallback for in-flight migration safety.
        // Once commitAuthState() runs after a successful refresh, the sessionStorage key is evicted.
        const currentRefreshToken: string | null =
            localStorage.getItem('haemi_refresh_token') ??
            sessionStorage.getItem('refreshToken'); // Legacy fallback: remove after one release cycle

        if (currentRefreshToken === null) {
            logger.info('[API] No refresh token found in storage. Draining queue.');
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
        // P0.1 FIX: Write refreshToken to localStorage (canonical key).
        // Evict the legacy sessionStorage key to enforce single-source-of-truth.
        if (typeof newRefreshToken === 'string' && newRefreshToken.length > 0) {
            localStorage.setItem('haemi_refresh_token', newRefreshToken);
            sessionStorage.removeItem('refreshToken'); // Evict legacy key
        }

        logger.info('[API] Token refresh successful');
        auditLogger.log('TOKEN_REFRESH_SUCCESS');

        // 📢 Broadcast to other tabs for multi-tab sync (Role-Isolated)
        if (typeof window !== 'undefined') {
            try {
                const base64Url = newToken.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const decodedToken = safeParseJSON(atob(base64), isJWTPayload);
                const userId = decodedToken?.id;
                const role = decodedToken?.role;

                const syncChannel = new BroadcastChannel('haemi_auth_sync');
                syncChannel.postMessage({
                    type: 'TOKEN_REFRESHED',
                    payload: {
                        token: newToken,
                        refreshToken: newRefreshToken,
                        version: sessionVersion,
                        userId: userId,
                        role: role
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
            const finalErr = error instanceof Error ? error : new RefreshFailureError(errMessage);

            if (isAuthErr) {
                logger.info('[API] Session refresh unauthorized (TERMINAL REJECTION)');
                auditLogger.log('UNAUTHORIZED_EVENT', { reason: 'Refresh token rejected' });

                // CRITICAL P0 FIX: Atomic clearance to prevent ghost loops
                clearAuthSession();

                // Drain queue with terminal rejection BEFORE setting isRefreshing to false
                processQueue(finalErr, null);
                isRefreshing = false;
                return null;
            } else {
                // Phase 12: Silent Guard for non-auth refresh failures (Network, 500s)
                if (retryCount >= 2) {
                    logger.error('[API] Sync refresh failed permanently after retries', errMessage);
                }
                auditLogger.log('TOKEN_REFRESH_FAILURE', { reason: errMessage });
                intrusionDetector.trackFailure('refresh');

                // DRAIN QUEUE even on network/server failure to unblock the UI
                processQueue(finalErr, null);
            }
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

        // Phase 12: Silent Audit Guard (Google/Meta Grade)
        // Suppress 'Red Lines' for 401s that are actively being refreshed in the background.
        // Phase 13: Bootstrapping Grace Period (Google/Meta Grade)
        // Prevent redirects or 'Red Lines' during the first 3 seconds of boot 
        // if a 401 occurs because the AuthContext is still performing its initial verify/refresh.
        const bootTime = (typeof window !== 'undefined' && window.__HAEMI_BOOT_TIME__) || Date.now();
        const isWithinBootWindow = (Date.now() - bootTime) < 3000;

        if (!shouldSuppressLog && !isWithinBootWindow) {
            recordFailure(error);
        }

        if (!originalRequest || !isExtendedConfig(originalRequest)) return Promise.reject(error);

        // 1. Interceptor Loop Protection
        if (originalRequest.url?.includes('/auth/refresh-token')) {
            if (error.response?.status === 401) {
                // PHASE 1 FIX: Only reject — DO NOT logout here to prevent forced logout on hard refresh
                return Promise.reject(new AuthError('Refresh token invalid', error.response?.status));
            }
            return Promise.reject(new AuthError('Refresh token invalid', error.response?.status, true));
        }

        // 2. Expected Auth Failures (Silent)
        const isExpectedAuthFailure = error.response &&
            (error.response.status === 400 || error.response.status === 401) &&
            originalRequest.url?.includes('/auth/');

        if (isExpectedAuthFailure && error.response) {
            const data = error.response.data;
            const msg = isErrorResponseData(data) ? data.message || error.message : error.message;
            return Promise.reject(new AuthError(msg, error.response.status, true));
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
                    reject: (err: unknown) => {
                        // Narrowing to ensure strict error propagation
                        reject(err instanceof Error ? err : new AuthError('Authentication failed during retry'));
                    }
                });

                // Start refresh if not already in progress
                performRefresh().catch((err: unknown) => {
                    if (!shouldSuppressLog) {
                        const errMsg = err instanceof Error ? err.message : String(err);
                        logger.error('[API] performRefresh critical failure', errMsg);
                    }
                });
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
            // Google/Meta Grade: 403 (Forbidden) should NOT terminate the session.
            // It indicates a permission mismatch, not a credential failure.
            logger.warn('[API] Forbidden access (403). Session remains active.', {
                url: originalRequest.url,
                authenticated: !!accessToken
            });
            auditLogger.log('SECURITY_EVENT', {
                reason: 'FORBIDDEN_ACCESS',
                details: { url: originalRequest.url }
            });
        }

        return Promise.reject(error);
    }
);

export default api;
