import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

import { logger, auditLogger } from '../utils/logger';
import { authService } from '../services/auth.service';
import { setAccessToken, setAppInitialized, isBackendConfirmed } from '../services/api';
import { AuthContext } from './auth-context-def';
import { isAuthError, type User, type LoginCredentials, type SignupCredentials } from '../types/auth.types';
import {
    safeParseJSON,
    isJWTPayload,
    isRefreshTokenPayload,
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

        setAuthState(prev => {
            const hasUserChanged = prev.user?.id !== user?.id;
            return {
                ...prev,
                user,
                token,
                authStatus: status,
                profileImageVersion: hasUserChanged ? Date.now() : prev.profileImageVersion,
                serverOffset: offset,
                sessionTimeout: sessionTimeout !== undefined ? sessionTimeout : prev.sessionTimeout
            };
        });
        
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
                // P1.0 FIX: Increased from 500ms → 2000ms.
                // Background tabs with throttled event loops (Chrome power-saving, mobile)
                // may not process the 'storage' event within 500ms, causing silent logout
                // signal drops. 2000ms gives sufficient time for even heavily throttled tabs
                // while still preventing bfcache replay on forward/back navigation.
                setTimeout((): void => localStorage.removeItem('haemi_logout_signal'), 2000);
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

        const handleVisibilityChange = (): void => {
            if (document.visibilityState !== 'visible') return;
            updateActivity();

            // ── P1.0 FIX: Zombie Tab Detection on Focus ─────────────────────────
            // When a background tab regains focus, validate that its auth state is
            // still consistent with shared localStorage. This catches two scenarios:
            //   (a) Refresh token cleared by another tab's logout → zombie state
            //   (b) Refresh token overwritten by a different user's login → role collision
            //
            // Without this guard, zombie tabs retain stale UI with full dashboard
            // access even after all tokens are invalidated (Forensic Finding #3).
            const currentUser: User | null = authStateRef.current.user;
            if (currentUser !== null) {
                const storedRefreshToken: string | null = localStorage.getItem('haemi_refresh_token');

                if (storedRefreshToken === null) {
                    logger.warn('[Auth] Zombie detected: refresh token absent on tab focus.', {
                        userId: currentUser.id,
                        role: currentUser.role
                    });
                    auditLogger.log('SESSION_TERMINATED', {
                        reason: 'ZOMBIE_DETECTION_NO_REFRESH_TOKEN',
                        userId: currentUser.id,
                        details: { role: currentUser.role, trigger: 'visibilitychange' }
                    });
                    commitAuthState(null, null, 'unauthenticated');
                    return;
                }

                // Validate refresh token ownership — detect cross-user collision
                try {
                    const base64Url: string = storedRefreshToken.split('.')[1];
                    const base64: string = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    const decoded = safeParseJSON(atob(base64), isRefreshTokenPayload);

                    if (decoded !== null && decoded.id !== currentUser.id) {
                        logger.warn('[Auth] Zombie detected: refresh token belongs to different user.', {
                            currentUserId: currentUser.id,
                            tokenUserId: decoded.id,
                            currentRole: currentUser.role
                        });
                        auditLogger.log('SECURITY_EVENT', {
                            reason: 'REFRESH_TOKEN_ROLE_COLLISION',
                            userId: currentUser.id,
                            details: {
                                currentRole: currentUser.role,
                                tokenOwnerId: decoded.id,
                                trigger: 'visibilitychange'
                            }
                        });
                        commitAuthState(null, null, 'unauthenticated');
                        return;
                    }
                } catch (decodeErr: unknown) {
                    logger.error('[Auth] Refresh token decode failure during zombie detection', {
                        error: decodeErr instanceof Error ? decodeErr.message : String(decodeErr)
                    });
                }
            }

            checkRefreshNeeded().catch((err: unknown): void => {
                logger.error('[Auth] Visibility sync failure', {
                    error: err instanceof Error ? err.message : String(err)
                });
            });
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
    }, [authState.authStatus, authState.token, logout, commitAuthState]);

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

        // ── P1.1 FIX: Dual-Key Storage Event Handler ────────────────────────
        // Listens for TWO distinct localStorage mutations:
        //   (1) haemi_refresh_token REMOVAL — catches cross-user logout cascade
        //   (2) haemi_logout_signal SET — original same-user logout mechanism
        //
        // Why both? The logout signal is scoped by userId+role, so logging out
        // as Patient does NOT signal Admin/Doctor tabs. But the refresh token
        // removal IS visible to all tabs (it's a shared key). Watching for its
        // deletion ensures ALL tabs detect session invalidation, regardless of
        // which user initiated the logout (Forensic Finding #2 + #3).
        const handleStorageChange = (event: StorageEvent): void => {
            const currentUser: User | null = authStateRef.current.user;

            // (1) Refresh token cleared by ANY peer tab's logout
            if (
                event.key === 'haemi_refresh_token' &&
                event.newValue === null &&
                currentUser !== null
            ) {
                logger.warn('[Auth] Refresh token cleared by peer tab — terminating session.', {
                    userId: currentUser.id,
                    role: currentUser.role
                });
                auditLogger.log('SESSION_TERMINATED', {
                    reason: 'PEER_TAB_REFRESH_TOKEN_CLEARED',
                    userId: currentUser.id,
                    details: { role: currentUser.role, trigger: 'storage_event' }
                });
                commitAuthState(null, null, 'unauthenticated');
                return;
            }

            // (2) Original: scoped logout signal (same userId + role match only)
            if (event.key !== 'haemi_logout_signal' || event.newValue === null) return;

            type LogoutSignal = Readonly<{ userId: string; role: string; ts: number }>;
            const isLogoutSignal = (v: unknown): v is LogoutSignal =>
                typeof v === 'object' &&
                v !== null &&
                typeof (v as Record<string, unknown>).userId === 'string' &&
                typeof (v as Record<string, unknown>).role === 'string';

            const signal: LogoutSignal | null = safeParseJSON(event.newValue, isLogoutSignal);

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

                    // ── P1.2 FIX: Role Confusion Guard ─────────────────────────
                    // After hard refresh, initAuth() optimistically restores from
                    // sessionStorage (tab-scoped), then refreshes using the shared
                    // localStorage refresh token. If another user logged in on a
                    // different tab, the refresh token belongs to THEM — the backend
                    // returns their identity, not ours.
                    //
                    // Detect this by comparing the refresh result's user against the
                    // optimistic session user. On mismatch, force re-login rather
                    // than silently switching roles (Forensic Finding #1).
                    const optimisticUser: User | null = authStateRef.current.user;
                    if (
                        optimisticUser !== null &&
                        verifyResult.user !== null &&
                        verifyResult.user.id !== optimisticUser.id
                    ) {
                        logger.warn('[Auth] Role confusion detected: refresh returned different user.', {
                            optimisticUserId: optimisticUser.id,
                            optimisticRole: optimisticUser.role,
                            refreshUserId: verifyResult.user.id,
                            refreshRole: verifyResult.user.role
                        });
                        auditLogger.log('SECURITY_EVENT', {
                            reason: 'ROLE_CONFUSION_DETECTED',
                            userId: optimisticUser.id,
                            details: {
                                optimisticRole: optimisticUser.role,
                                refreshUserId: verifyResult.user.id,
                                refreshRole: verifyResult.user.role,
                                trigger: 'initAuth'
                            }
                        });
                        commitAuthState(null, null, 'unauthenticated');
                        return;
                    }

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

    const contextValue = React.useMemo(() => ({
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
        isAuthenticated: (() => {
            const isAuth = (
                authState.authStatus === 'authenticated' ||
                (authState.authStatus === 'app_ready' && authState.user !== null)
            ) && authState.token !== null;
            
            if (!isAuth || !authState.token) return false;
            
            try {
                // Surgical validation of JWT expiry within the computation block
                const parts = authState.token.split('.');
                if (parts.length !== 3) return false;
                const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                if (!payload || typeof payload.exp !== 'number') return false;
                
                const now = Math.floor(Date.now() / 1000);
                return payload.exp > now;
            } catch (err: unknown) {
                logger.error('[Auth] Centralized expiry validation systemic failure', {
                    error: err instanceof Error ? err.message : String(err)
                });
                return false;
            }
        })()
    }), [
        authState.user, 
        authState.token, 
        authState.authStatus, 
        authState.profileImageVersion, 
        isRefreshing, 
        isTokenNearDeath,
        login, 
        signup, 
        logout, 
        refreshUser
    ]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};
