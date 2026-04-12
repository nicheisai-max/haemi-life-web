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
            if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
            sessionStorage.setItem('user', JSON.stringify(user));
        } else {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('refreshToken');
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

    const logout = useCallback(async () => {
        const currentUserId = authStateRef.current.user?.id;
        const currentRole = authStateRef.current.user?.role;
        
        try {
            await authService.logout();
            logger.info('[Auth] Remote session invalidated successfully');
        } catch (error: unknown) {
            // P0 FIX: Institutional Axios error handling using imported axios
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    logger.warn('[Auth] Logout: Remote session already void (Idempotent success)');
                } else {
                    logger.error('[Auth] Remote logout failure intercepted', { error: error.message });
                }
            } else {
                logger.error('[Auth] Unknown error during remote logout', { error: String(error) });
            }
        }

        const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
        if (!IS_DEMO_MODE && currentUserId) {
            try {
                const authChannel = new BroadcastChannel('haemi_auth_sync');
                authChannel.postMessage({ type: 'LOGOUT', payload: { userId: currentUserId, role: currentRole } });
                authChannel.close();

                localStorage.setItem('haemi_logout_signal', JSON.stringify({
                    userId: currentUserId, role: currentRole, ts: Date.now()
                }));
                setTimeout(() => localStorage.removeItem('haemi_logout_signal'), 500);
            } catch (err) {
                logger.error('[AuthSync] Logout broadcast failure insulated', { error: String(err) });
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

    useEffect(() => {
        const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
        let authChannel: BroadcastChannel | null = null;

        if (!IS_DEMO_MODE) {
            authChannel = new BroadcastChannel('haemi_auth_sync');
            authChannel.onmessage = (event) => {
                const { type, payload } = event.data;
                const latest = authStateRef.current;
                
                if (type === 'LOGOUT') {
                    // P0 CROSS-TAB TERMINATION: Ensure identity match and version hierarchy
                    if (payload?.userId === latest.user?.id && payload?.role === latest.user?.role) {
                        logger.warn('[AuthSync] Session termination signal received from peer tab. Initiating hard teardown.');
                        
                        // 1. Invalidate local memory state immediately
                        commitAuthState(null, null, 'unauthenticated');
                        
                        // 2. FORCE HARD REDIRECT: This is the ONLY way to reliably kill 
                        // all active clinical providers (Chat, Notifications) from memory.
                        window.location.href = '/login'; 
                    }
                } else if (type === 'TOKEN_REFRESHED') {
                    if (payload.userId === latest.user?.id && payload.role === latest.user?.role) {
                        logger.info('[AuthSync] Token refresh signal received from peer tab. Synchronizing local state.');
                        commitAuthState(latest.user, payload.token, latest.authStatus === 'unauthenticated' ? 'authenticated' : latest.authStatus, payload.refreshToken, latest.serverOffset, latest.sessionTimeout);
                    }
                }
            };
        }

        const handleUnauthorized = () => {
            const user = authStateRef.current.user;
            if (authChannel && user) authChannel.postMessage({ type: 'LOGOUT', payload: { userId: user.id, role: user.role } });
            commitAuthState(null, null, 'unauthenticated');
        };

        const handleTokenRefreshed = (event: Event) => {
            const { token, refreshToken, serverTime, sessionTimeout } = (event as CustomEvent).detail;
            
            // P0 IDEPOTENCY GUARD: Prevent redundant state commits 
            // from the same tab or identical updates
            if (authStateRef.current.token === token) return;

            logger.info('[Auth] Silent token synchronization committed');
            
            setAuthState(prev => {
                const offset = (serverTime ? new Date(serverTime).getTime() : Date.now()) - Date.now();
                return { ...prev, token, serverOffset: offset, sessionTimeout: sessionTimeout || prev.sessionTimeout };
            });
            
            sessionStorage.setItem('token', token);
            if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
        };

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === 'haemi_logout_signal' && event.newValue) {
                const signal = safeParseJSON(event.newValue, (v: unknown): v is { userId: string, role: string } => {
                    return typeof v === 'object' && v !== null && 'userId' in v && 'role' in v;
                });
                const user = authStateRef.current.user;
                if (signal && user && signal.userId === user.id && signal.role === user.role) commitAuthState(null, null, 'unauthenticated');
            }
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);
        window.addEventListener('auth:token-refreshed', handleTokenRefreshed);
        window.addEventListener('storage', handleStorageChange);

        return () => {
            if (authChannel) authChannel.close();
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
                // P0 FIX: Unified Identity Error Narrowing using isAuthError and axios.isAxiosError
                if (isAuthError(error) || (axios.isAxiosError(error) && error.response?.status === 401)) {
                    logger.info('[Boot] Initialization probe: No valid session found (Graceful fallback)');
                } else {
                    logger.error('[Boot] Initialization failure', { error: String(error) });
                }
                commitAuthState(null, null, 'unauthenticated');
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
            user: authState.user, token: authState.token, authStatus: authState.authStatus, profileImageVersion: authState.profileImageVersion,
            login, signup, logout, refreshUser, isRefreshing, isTokenNearDeath,
            isLoading: ['initializing', 'auth_check', 'onboarding_check'].includes(authState.authStatus),
            isAuthenticated: (authState.authStatus === 'authenticated' || (authState.authStatus === 'app_ready' && !!authState.user)) && !!authState.token && !isTokenNearDeath
        }}>
            {children}
        </AuthContext.Provider>
    );
};
