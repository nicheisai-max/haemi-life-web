import { useState, useEffect, useCallback, useRef } from 'react';

import { logger } from '../utils/logger';
import { authService } from '../services/auth.service';
import { setAccessToken, setAppInitialized } from '../services/api';
import { AuthContext } from './auth-context-def';
import type { User, LoginCredentials, SignupCredentials } from '../types/auth.types';

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
        const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // ─── Deterministic Initialization Phase ──────────────────────────────────
    const initialUser = sessionStorage.getItem('user');
    const initialToken = sessionStorage.getItem('token');

    const [authState, setAuthState] = useState<AuthState>({
        user: initialUser ? JSON.parse(initialUser) : null,
        token: initialToken,
        authStatus: 'initializing',
        profileImageVersion: Date.now(),
        serverOffset: 0,
        sessionTimeout: null
    });

    // Restore API state immediately before any hooks run
    if (initialToken) {
        setAccessToken(initialToken);
    }

    const authStateRef = useRef<AuthState>(authState);
    useEffect(() => {
        authStateRef.current = authState;
    }, [authState]);

    // ─── Phase 5, 6 & 7 Hardening: Silent Proactive Refresh (Singleton & Multi-Event)
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isRefreshingRef = useRef<boolean>(false);
    const lastActivityRef = useRef<number>(Date.now());

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
            const latestToken = authStateRef.current.token;
            const decoded = decodeJWT(latestToken);
            if (!decoded?.exp) return;

            const now = Math.floor((Date.now() + authStateRef.current.serverOffset) / 1000);
            const timeUntilExpiry = decoded.exp - now;

            // Zero-Trust: 120s buffer adjusted by server-time sync
            if (timeUntilExpiry < 120) {
                if (isRefreshingRef.current) return;
                
                logger.info(`[Auth] Proactive refresh (exp: ${timeUntilExpiry}s, offset: ${authStateRef.current.serverOffset}ms)`);
                try {
                    isRefreshingRef.current = true;
                    // Use the centralized performRefresh which handles the API call
                    const { performRefresh } = await import('../services/api');
                    await performRefresh();
                } catch (err) {
                    logger.error('[Auth] Proactive refresh failed', err);
                } finally {
                    isRefreshingRef.current = false;
                }
            }

            // Phase 3: Idle Detection logic
            const timeoutMinutes = authStateRef.current.sessionTimeout;
            if (timeoutMinutes) {
                const idleLimitMs = timeoutMinutes * 60 * 1000;
                const timeIdle = Date.now() - lastActivityRef.current;
                const timeRemaining = idleLimitMs - timeIdle;

                // Trigger popup 2 minutes before absolute timeout
                if (timeRemaining > 0 && timeRemaining < 120000) {
                    window.dispatchEvent(new CustomEvent('auth:session-expiring', { 
                        detail: { timeLeft: Math.floor(timeRemaining / 1000) } 
                    }));
                }
            }
        };

        const updateActivity = () => {
            lastActivityRef.current = Date.now();
        };

        // Phase 7: Activity Listeners
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
        events.forEach(name => window.addEventListener(name, updateActivity));

        // Phase 7: Visibility-Event Refresh (Bypasses background throttling)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                updateActivity();
                logger.info('[Auth] Tab visible again. Performing proactive expiry check...');
                checkRefreshNeeded();
            }
        };

        refreshIntervalRef.current = setInterval(checkRefreshNeeded, 15000); 
        window.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
            cleanup();
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            events.forEach(name => window.removeEventListener(name, updateActivity));
        };
    }, [authState.authStatus, authState.token]);

    // ─── BroadcastChannel for Cross-Tab Sync ───────────────────────────────
    useEffect(() => {
        const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
        let authChannel: BroadcastChannel | null = null;

        if (!IS_DEMO_MODE) {
            authChannel = new BroadcastChannel('haemi_auth_sync');

            const handleMessage = (event: MessageEvent) => {
                const { type, payload } = event.data;
                const latestState = authStateRef.current;

                if (type === 'LOGOUT') {
                    // SECURE SYNC: Only logout if the message targets our current user identity
                    if (payload?.userId && latestState.user?.id === payload.userId) {
                        logger.info('[AuthSync] Logout received from other tab (Shared Identity)');
                        setAccessToken(null);
                        sessionStorage.removeItem('user');
                        sessionStorage.removeItem('token');
                        sessionStorage.removeItem('refreshToken');
                        setAuthState(prev => ({ 
                            ...prev,
                            user: null, 
                            token: null, 
                            authStatus: 'unauthenticated'
                        }));
                    }
                } else if (type === 'TOKEN_REFRESHED') {
                    // MULTI-TAB SYNC: Update credentials only if the message targets our current user identity
                    if (payload?.token && payload?.refreshToken && payload?.userId === latestState.user?.id) {
                        logger.info('[AuthSync] Token refresh received from other tab. Synchronizing state...');
                        setAccessToken(payload.token);
                        sessionStorage.setItem('token', payload.token);
                        sessionStorage.setItem('refreshToken', payload.refreshToken);
                        setAuthState(prev => ({ 
                            ...prev, 
                            token: payload.token,
                            authStatus: prev.authStatus === 'unauthenticated' ? 'authenticated' : prev.authStatus
                        }));
                    }
                }
            };
            authChannel.onmessage = handleMessage;
        }

        const handleUnauthorized = () => {
            const currentUserId = authStateRef.current.user?.id;
            logger.warn('[Auth] Unauthorized event detected');
            setAccessToken(null);
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('refreshToken');
            setAuthState(prev => ({ 
                ...prev,
                user: null, 
                token: null, 
                authStatus: 'unauthenticated'
            }));
            
            // Broadcast logout ONLY for this specific user ID
            if (authChannel && currentUserId) {
                authChannel.postMessage({ type: 'LOGOUT', payload: { userId: currentUserId } });
            }
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);

        // Lifecycle Guard: Move token-refreshed event out of render
        const handleTokenRefreshed = (event: Event) => {
            const customEvent = event as CustomEvent<{ 
                token: string, 
                refreshToken?: string, 
                serverTime?: string, 
                sessionTimeout?: number 
            }>;
            const { token, refreshToken, serverTime, sessionTimeout } = customEvent.detail;
            const decoded = decodeJWT(token);
            if (!decoded) return;

            const serverMs = serverTime ? new Date(serverTime).getTime() : Date.now();
            const offset = serverMs - Date.now();

            setAuthState(prev => ({
                ...prev,
                token,
                serverOffset: offset,
                sessionTimeout: sessionTimeout || prev.sessionTimeout,
                authStatus: prev.authStatus === 'unauthenticated' ? 'authenticated' : prev.authStatus
            }));
            
            sessionStorage.setItem('token', token);
            if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
        };

        window.addEventListener('auth:token-refreshed', handleTokenRefreshed);

        return () => {
            if (authChannel) authChannel.close();
            window.removeEventListener('auth:unauthorized', handleUnauthorized);
            window.removeEventListener('auth:token-refreshed', handleTokenRefreshed);
        };
    }, []); 

    // ─── Phase 7 Hardening: Atomic Identity Guard ──────────────────────────
    const commitAuthState = useCallback((
        user: User | null, 
        token: string | null, 
        status: AuthState['authStatus'], 
        refreshToken?: string | null,
        serverTime?: string,
        sessionTimeout?: number
    ) => {
        // 1. Unified Network Sink (Atomic update outside of render)
        setAccessToken(token);

        // 2. Unified Storage Sink
        if (token && user) {
            sessionStorage.setItem('token', token);
            if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
            sessionStorage.setItem('user', JSON.stringify(user));
        } else {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('refreshToken');
            sessionStorage.removeItem('user');
        }

        // 3. Server Time Sync
        const serverMs = serverTime ? new Date(serverTime).getTime() : Date.now();
        const offset = serverMs - Date.now();

        // 4. Unified State Sink
        setAuthState(prev => ({
            user,
            token,
            authStatus: status,
            profileImageVersion: Date.now(),
            serverOffset: offset,
            sessionTimeout: sessionTimeout || prev.sessionTimeout
        }));
        
        logger.info(`[Auth] Identity Commit: ${status} (Offset: ${offset}ms)`);
    }, []);

    // ─── Initial Boot ────────────────────────────────────────────────────────
    useEffect(() => {
        const BOOT_TIMEOUT = 15000;

        const initAuth = async () => {
            const timeoutGuard = setTimeout(() => {
                if (authStateRef.current.authStatus !== 'app_ready') {
                    logger.error('[Boot] Boot timeout reached');
                    setAuthState(prev => ({ ...prev, authStatus: 'app_ready' }));
                    setAppInitialized();
                }
            }, BOOT_TIMEOUT);

            try {
                // Keep 'initializing' status during the health check to satisfy tests
                const isBackendReady = await authService.waitForBackend(5, 1000);
                if (!isBackendReady) {
                    commitAuthState(null, null, 'offline');
                    return;
                }

                const refreshResult = await authService.refreshToken();

                if (refreshResult.authenticated && refreshResult.token) {
                    const verifyResult = await authService.verifySession();
                    commitAuthState(
                        verifyResult.user, 
                        refreshResult.token, 
                        'authenticated', 
                        refreshResult.refreshToken,
                        verifyResult.serverTime,
                        verifyResult.sessionTimeout
                    );
                } else {
                    commitAuthState(null, null, 'unauthenticated');
                }
                
                // Signal boot completion without overwriting status
                setAppInitialized();

            } catch (error: unknown) {
                logger.error('[Boot] Initialization failure', error);
                commitAuthState(null, null, 'unauthenticated');
                setAuthState(prev => ({ ...prev, authStatus: 'app_ready' }));
            } finally {
                clearTimeout(timeoutGuard);
                setAppInitialized();
                window.dispatchEvent(new CustomEvent('auth:ready'));
            }
        };

        initAuth();
    }, [commitAuthState]);

    const login = useCallback(async (credentials: LoginCredentials) => {
        const result = await authService.login(credentials);
        commitAuthState(
            result.user, 
            result.token, 
            'authenticated', 
            result.refreshToken, 
            result.serverTime, 
            result.sessionTimeout
        );
    }, [commitAuthState]);

    const signup = useCallback(async (credentials: SignupCredentials) => {
        const result = await authService.signup(credentials);
        commitAuthState(
            result.user, 
            result.token, 
            'authenticated', 
            result.refreshToken, 
            result.serverTime, 
            result.sessionTimeout
        );
    }, [commitAuthState]);

    const logout = useCallback(async () => {
        const currentUserId = authStateRef.current.user?.id;
        commitAuthState(null, null, 'unauthenticated');

        const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
        if (!IS_DEMO_MODE && currentUserId) {
            const authChannel = new BroadcastChannel('haemi_auth_sync');
            authChannel.postMessage({ type: 'LOGOUT', payload: { userId: currentUserId } });
            authChannel.close();
        }

        try {
            await authService.logout();
        } catch (e) {
            logger.error('Logout failed', e);
        }
    }, [commitAuthState]);

    const refreshUser = useCallback(async () => {
        try {
            const { user: verifiedUser } = await authService.verifySession();
            setAuthState(prev => ({
                ...prev,
                user: verifiedUser,
                profileImageVersion: Date.now()
            }));
            sessionStorage.setItem('user', JSON.stringify(verifiedUser));
        } catch (error) {
            logger.error('[Auth] Failed to refresh user:', error);
        }
    }, []);

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
            isLoading: authState.authStatus === 'initializing' ||
                authState.authStatus === 'auth_check' ||
                authState.authStatus === 'onboarding_check',
            isAuthenticated: authState.authStatus === 'authenticated' ||
                (authState.authStatus === 'app_ready' && !!authState.user),
        }}>
            {children}
        </AuthContext.Provider>
    );
};

// AuthContext and useAuth moved to AuthContextDef.ts and useAuth.ts to satisfy Fast Refresh rules.
