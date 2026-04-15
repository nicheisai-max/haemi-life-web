import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

import { logger } from '../utils/logger';
import { authService } from '../services/auth.service';
import { setAccessToken, setAppInitialized, isBackendConfirmed } from '../services/api';
import { AuthContext } from './auth-context-def';
import { isAuthError, type User, type LoginCredentials, type SignupCredentials } from '../types/auth.types';
import { 
    safeParseJSON, 
    isJWTPayload,
    isUser 
} from '../utils/type-guards';

interface AuthState {
    user: User | null;
    token: string | null;
    authStatus: 'initializing' | 'auth_check' | 'onboarding_check' | 'authenticated' | 'unauthenticated' | 'offline' | 'app_ready';
    profileImageVersion: number;
    serverOffset: number; // ms difference (server - client)
    sessionTimeout: number | null; // minutes
}

// ─── Surgical JWT Decoder (No dependencies) ──────────────────────────────────
const decodeJWT = (token: string | null) => {
    if (!token) return null;
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonString = atob(base64);
        return safeParseJSON(jsonString, isJWTPayload);
    } catch {
        return null;
    }
};

// ─── MODULE-LEVEL BOOTSTRAP GUARDS ─────────────────────────────────────────
let hasGlobalBootstrapExecuted = false;
let hasBootInitiated = false;
const OPTIMISTIC_TOKEN_MIN_TTL_SECONDS = 30 as const;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // ─── 1. ISOLATED RENDER-SAFE STATE INIT ─────────────────────────────────────
    const [authState, setAuthState] = useState<AuthState>(() => {
        const initialUserJson = sessionStorage.getItem('user');
        const initialToken = sessionStorage.getItem('token');
        const user = initialUserJson ? safeParseJSON(initialUserJson, isUser) : null;
        const sanitizedUser = user ? { ...user, hasConsent: !!user.hasConsent } : null;

        return {
            user: sanitizedUser,
            token: initialToken,
            authStatus: 'initializing',
            profileImageVersion: Date.now(),
            serverOffset: 0,
            sessionTimeout: null
        };
    });

    const authStateRef = useRef<AuthState>(authState);
    useEffect(() => {
        authStateRef.current = authState;
    }, [authState]);

    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isTokenNearDeath, setIsTokenNearDeath] = useState(false);
    const isRefreshingRef = useRef<boolean>(false);
    const lastInteractionRef = useRef<number>(Date.now());

    // ─── 2. STABLE IDENTITY CALLBACKS ──────────────────────────────────────────
    
    /**
     * 🛡️ INSTITUTIONAL ATOMICITY GUARD:
     * Commits auth state to all three layers (Memory, Storage, State) in unison.
     */
    const commitAuthState = useCallback((
        user: User | null, 
        token: string | null, 
        status: AuthState['authStatus'], 
        refreshToken?: string | null,
        serverTimeOrOffset?: string | number,
        sessionTimeout?: number | null
    ) => {
        setAccessToken(token);

        if (token && user) {
            sessionStorage.setItem('token', token);
            // P0.1: Refresh token canonical key moved to localStorage (origin-scoped).
            // sessionStorage is tab-scoped — a new tab or DevTools "Empty Cache & Hard Reset"
            // wipes it entirely, destroying the refresh token and forcing re-login.
            // localStorage survives tab creation, hard refreshes, and cache resets.
            if (refreshToken) {
                localStorage.setItem('haemi_refresh_token', refreshToken);
                sessionStorage.removeItem('refreshToken'); // Evict legacy key on every commit
            }
            sessionStorage.setItem('user', JSON.stringify(user));
        } else {
            sessionStorage.removeItem('token');
            localStorage.removeItem('haemi_refresh_token'); // P0.1: Canonical key
            sessionStorage.removeItem('refreshToken');      // P0.1: Legacy key eviction
            sessionStorage.removeItem('user');
        }

        let offset: number;
        if (typeof serverTimeOrOffset === 'number') {
            offset = serverTimeOrOffset;
        } else {
            const serverMs = serverTimeOrOffset ? new Date(serverTimeOrOffset).getTime() : Date.now();
            offset = serverMs - Date.now();
        }

        setAuthState(prev => ({
            ...prev,
            user,
            token,
            authStatus: status,
            profileImageVersion: Date.now(),
            serverOffset: offset,
            sessionTimeout: sessionTimeout !== undefined ? sessionTimeout : prev.sessionTimeout
        }));
        
        logger.info(`[Auth] Identity Commit: ${status} (Offset: ${offset}ms)`);
    }, []);

    const logout = useCallback(async (): Promise<void> => {
        // Capture identity BEFORE clearing — snapshot is stable even if state is nulled mid-async
        const currentUserId: string | undefined = authStateRef.current.user?.id;
        const currentRole: string | undefined = authStateRef.current.user?.role;
        
        try {
            await authService.logout();
            logger.info('[Auth] Remote session invalidated successfully');
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    logger.warn('[Auth] Logout: Remote session already void (Idempotent success)');
                } else {
                    logger.error('[Auth] Remote logout failure intercepted', {
                        error: error.message
                    });
                }
            } else {
                logger.error('[Auth] Unknown error during remote logout', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        // P0.3 FIX: Cross-tab logout now exclusively via localStorage 'storage' event.
        // Removed BroadcastChannel postMessage — the previous implementation had two bugs:
        //   Bug 1: The BC message had no 'version' field; api.ts listener checked
        //          'payload.version > sessionVersion' → undefined > 0 === false → SILENTLY IGNORED.
        //   Bug 2: auth-context also had a BC RECEIVER (duplicate of api.ts's SSOT handler),
        //          causing double-processing and a hard window.location.href redirect.
        // The localStorage 'storage' event fires in ALL other same-origin tabs reliably.
        const IS_DEMO_MODE: boolean = import.meta.env.VITE_DEMO_MODE === 'true';
        if (!IS_DEMO_MODE && typeof currentUserId === 'string' && typeof currentRole === 'string') {
            try {
                const signal = JSON.stringify({
                    userId: currentUserId,
                    role: currentRole,
                    ts: Date.now()
                });
                localStorage.setItem('haemi_logout_signal', signal);
                // Self-cleanup: prevents signal replay if tab is restored from bfcache
                setTimeout((): void => localStorage.removeItem('haemi_logout_signal'), 500);
                logger.info('[Auth] Cross-tab logout signal dispatched', {
                    userId: currentUserId,
                    role: currentRole
                });
            } catch (syncErr: unknown) {
                logger.error('[Auth] Cross-tab logout signal failure (insulated)', {
                    error: syncErr instanceof Error ? syncErr.message : String(syncErr)
                });
            }
        }

        commitAuthState(null, null, 'unauthenticated');
    }, [commitAuthState]);

    const login = useCallback(async (credentials: LoginCredentials) => {
        const result = await authService.login(credentials);
        commitAuthState(result.user, result.token, 'authenticated', result.refreshToken, result.serverTime, result.sessionTimeout);
    }, [commitAuthState]);

    const signup = useCallback(async (credentials: SignupCredentials) => {
        const result = await authService.signup(credentials);
        commitAuthState(result.user, result.token, 'authenticated', result.refreshToken, result.serverTime, result.sessionTimeout);
    }, [commitAuthState]);

    const refreshUser = useCallback(async () => {
        try {
            const { user: verifiedUser } = await authService.verifySession();
            setAuthState(prev => ({ ...prev, user: verifiedUser, profileImageVersion: Date.now() }));
            sessionStorage.setItem('user', JSON.stringify(verifiedUser));
            logger.info('[Auth] User profile refreshed successfully');
        } catch (error) {
            logger.error('[Auth] Failed to refresh user profile:', error);
        }
    }, []);

    // ─── 3. INSTITUTIONAL EFFECTS ──────────────────────────────────────────────

    useEffect(() => {
        if (!hasGlobalBootstrapExecuted) {
            hasGlobalBootstrapExecuted = true;
            const token = sessionStorage.getItem('token');
            if (token) setAccessToken(token);
        }
    }, []);

    useEffect(() => {
        const cleanup = () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
                refreshIntervalRef.current = null;
            }
        };
        cleanup();

        if (authState.authStatus !== 'authenticated' || !authState.token) return;

        const checkRefreshNeeded = async () => {
            const current = authStateRef.current;
            if (!current || !current.token) return;

            try {
                const decodedToken = decodeJWT(current.token);
                if (!decodedToken) return;

                const now = Math.floor((Date.now() + current.serverOffset) / 1000);
                const timeUntilExpiry = decodedToken.exp - now;

                setIsTokenNearDeath(timeUntilExpiry < 10);

                if (timeUntilExpiry < 300) {
                    if (isRefreshingRef.current) return;
                    isRefreshingRef.current = true;
                    setIsRefreshing(true);
                    
                    try {
                        const { performRefresh } = await import('../services/api');
                        const refreshedToken = await performRefresh();
                        if (!refreshedToken && timeUntilExpiry <= 0) throw new Error('TERM_EXPIRY');
                    } catch (innerError: unknown) {
                        const isTerminal = (innerError instanceof Error && innerError.message === 'TERM_EXPIRY') || timeUntilExpiry <= 0;
                        if (isTerminal) {
                            cleanup();
                            await logout();
                            return;
                        }
                    }
                }
                
                const timeoutMinutes = current.sessionTimeout;
                if (timeoutMinutes) {
                    const idleLimitMs = timeoutMinutes * 60 * 1000;
                    const elapsed = Date.now() - lastInteractionRef.current;
                    const timeRemaining = idleLimitMs - elapsed;
                    if (timeRemaining > 0 && timeRemaining < 120000) {
                        window.dispatchEvent(new CustomEvent('auth:session-expiring', { detail: { timeLeft: Math.floor(timeRemaining / 1000) } }));
                    }
                }
            } catch (error: unknown) {
                logger.error('[Auth] Proactive refresh engine systemic failure:', error instanceof Error ? error.message : String(error));
            } finally {
                isRefreshingRef.current = false;
                setIsRefreshing(false);
            }
        };

        const updateActivity = () => { lastInteractionRef.current = Date.now(); };
        
        type AuthInteractionEvent = 'mousedown' | 'mousemove' | 'keydown' | 'scroll' | 'touchstart';
        const interactionEvents: AuthInteractionEvent[] = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
        
        interactionEvents.forEach(name => {
            try {
                window.addEventListener(name, updateActivity, { passive: true });
            } catch (err) {
                logger.error(`[Auth] Failed to attach global listener: ${name}`, err);
            }
        });

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') { 
                updateActivity(); 
                checkRefreshNeeded().catch(err => logger.error('[Auth] Visibility sync failure', err)); 
            }
        };

        refreshIntervalRef.current = setInterval(() => {
            checkRefreshNeeded().catch(err => logger.error('[Auth] Periodic sync failure', err));
        }, 15000); 

        window.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
            cleanup();
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            interactionEvents.forEach(name => window.removeEventListener(name, updateActivity));
        };
    }, [authState.authStatus, authState.token, logout]);

    // P0.3 FIX: Removed duplicate BroadcastChannel receiver from auth-context.
    // api.ts is the SSOT for all BC operations (token refresh sync, LOGOUT processing).
    // Cross-module bridge uses:  auth:unauthorized (custom window event) — api.ts → auth-context
    // Cross-tab logout uses:     haemi_logout_signal (localStorage storage event) — tab A → tab B
    // Cross-tab token sync uses: haemi_auth_sync BroadcastChannel in api.ts only.
    useEffect((): (() => void) => {

        // Triggered by api.ts clearAuthSession() via window.dispatchEvent('auth:unauthorized')
        const handleUnauthorized = (): void => {
            // api.ts has already: cleared tokens, incremented sessionVersion, broadcast to peers.
            // We only need to commit the React state here — no extra BC needed.
            logger.warn('[Auth] Unauthorized event received — terminating local session.');
            commitAuthState(null, null, 'unauthenticated');
        };

        // Triggered by api.ts setAccessToken() via window.dispatchEvent('auth:token-refreshed')
        const handleTokenRefreshed = (event: Event): void => {
            const customEvent = event as CustomEvent<{
                token: string;
                refreshToken: string | null | undefined;
                serverTime: string | undefined;
                sessionTimeout: number | undefined;
            }>;
            const { token, refreshToken, serverTime, sessionTimeout } = customEvent.detail;

            // Idempotency guard: skip if this tab already has the same token
            if (authStateRef.current.token === token) return;

            logger.info('[Auth] Silent token synchronization committed.');

            setAuthState((prev: AuthState): AuthState => {
                const serverMs: number = serverTime
                    ? new Date(serverTime).getTime()
                    : Date.now();
                return {
                    ...prev,
                    token,
                    serverOffset: serverMs - Date.now(),
                    sessionTimeout: sessionTimeout ?? prev.sessionTimeout
                };
            });

            sessionStorage.setItem('token', token);
            // P0.1: Write refreshToken to localStorage (canonical storage)
            if (typeof refreshToken === 'string' && refreshToken.length > 0) {
                localStorage.setItem('haemi_refresh_token', refreshToken);
                sessionStorage.removeItem('refreshToken'); // Evict legacy key
            }
        };

        // Triggered when logout() sets haemi_logout_signal in localStorage.
        // The 'storage' event fires in OTHER tabs only (not the sender) — correct by spec.
        const handleStorageChange = (event: StorageEvent): void => {
            if (event.key !== 'haemi_logout_signal' || event.newValue === null) return;

            type LogoutSignal = Readonly<{ userId: string; role: string; ts: number }>;
            const isLogoutSignal = (v: unknown): v is LogoutSignal =>
                typeof v === 'object' &&
                v !== null &&
                typeof (v as Record<string, unknown>).userId === 'string' &&
                typeof (v as Record<string, unknown>).role === 'string';

            const signal: LogoutSignal | null = safeParseJSON(event.newValue, isLogoutSignal);
            const currentUser = authStateRef.current.user;

            if (
                signal !== null &&
                currentUser !== null &&
                signal.userId === currentUser.id &&
                signal.role === currentUser.role
            ) {
                logger.warn('[Auth] localStorage logout signal received — terminating peer session.', {
                    userId: signal.userId,
                    role: signal.role
                });
                commitAuthState(null, null, 'unauthenticated');
            }
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);
        window.addEventListener('auth:token-refreshed', handleTokenRefreshed);
        window.addEventListener('storage', handleStorageChange);

        return (): void => {
            window.removeEventListener('auth:unauthorized', handleUnauthorized);
            window.removeEventListener('auth:token-refreshed', handleTokenRefreshed);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [commitAuthState]);

    useEffect(() => {
        if (hasBootInitiated) return;
        hasBootInitiated = true;
        const BOOT_TIMEOUT = 5000;

        const initAuth = async () => {
            const timeoutGuard = setTimeout(() => {
                if (authStateRef.current.authStatus !== 'app_ready') {
                    setAuthState(prev => ({ ...prev, authStatus: 'app_ready' }));
                    setAppInitialized();
                }
            }, BOOT_TIMEOUT);

            try {
                const storedToken = sessionStorage.getItem('token');
                if (storedToken) {
                    const decoded = decodeJWT(storedToken);
                    if (decoded && decoded.exp > (Math.floor(Date.now() / 1000) + OPTIMISTIC_TOKEN_MIN_TTL_SECONDS)) {
                        const user = safeParseJSON(sessionStorage.getItem('user') || '', isUser);
                        if (user) commitAuthState(user, storedToken, 'authenticated');
                    }
                }
                const isReady = isBackendConfirmed() || await authService.waitForBackend(2, 500);
                if (!isReady) { if (!authStateRef.current.token) commitAuthState(null, null, 'offline'); return; }
                const refreshResult = await authService.refreshToken();
                if (refreshResult.authenticated && refreshResult.token) {
                    const verifyResult = await authService.verifySession({ silent: true });
                    commitAuthState(verifyResult.user, refreshResult.token, 'authenticated', refreshResult.refreshToken, verifyResult.serverTime, verifyResult.sessionTimeout);
                } else if (!authStateRef.current.token) { commitAuthState(null, null, 'unauthenticated'); }
            } catch (error: unknown) {

                // P0.2 FIX: Discriminated error handling — only logout on confirmed auth failures.
                // Network errors (ECONNABORTED, ERR_NETWORK), 5xx, and unexpected responses
                // must NOT clear an already-established optimistic session.
                // Logging: all paths use logger — no console.* calls.
                const isConfirmedAuthFailure: boolean =
                    isAuthError(error) ||
                    (axios.isAxiosError(error) && error.response?.status === 401);

                if (isConfirmedAuthFailure) {
                    logger.info('[Boot] Initialization probe: No active session confirmed. Transitioning to unauthenticated.');
                    commitAuthState(null, null, 'unauthenticated');
                } else {
                    // Non-auth failure: preserve any optimistic session set from sessionStorage.
                    // If the user had a valid token in sessionStorage, they remain authenticated.
                    // Only fall back to unauthenticated if NO token was ever established.
                    const errorMessage: string = error instanceof Error ? error.message : String(error);
                    logger.error('[Boot] Non-auth initialization failure — preserving existing session state', {
                        error: errorMessage,
                        hasExistingToken: authStateRef.current.token !== null
                    });
                    if (authStateRef.current.token === null) {
                        commitAuthState(null, null, 'unauthenticated');
                    }
                }
            } finally {
                clearTimeout(timeoutGuard);
                setAppInitialized();
                window.dispatchEvent(new CustomEvent('auth:ready'));
            }
        };
        initAuth();
    }, [commitAuthState]);

    return (
        <AuthContext.Provider value={{
            user: authState.user,
            token: authState.token,
            authStatus: authState.authStatus,
            profileImageVersion: authState.profileImageVersion,
            login,
            signup,
            logout,
            refreshUser,
            isRefreshing,
            isTokenNearDeath,
            isLoading: ['initializing', 'auth_check', 'onboarding_check'].includes(authState.authStatus),
            // P0.4 FIX: isAuthenticated must NOT be falsified by isTokenNearDeath.
            // When a token is within 10s of expiry, the background refresh interval fires.
            // If isAuthenticated became false here, ProtectedRoute would redirect to /login
            // BEFORE the refresh completes — a race condition that logs out valid users.
            // isTokenNearDeath is exposed separately so ProtectedRoute can show a loader
            // while refreshing, without triggering a redirect. API calls are gated in api.ts.
            isAuthenticated: (
                authState.authStatus === 'authenticated' ||
                (authState.authStatus === 'app_ready' && authState.user !== null)
            ) && authState.token !== null
        }}>
            {children}
        </AuthContext.Provider>
    );
};
