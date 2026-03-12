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
        profileImageVersion: Date.now()
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

            const now = Math.floor(Date.now() / 1000);
            const timeUntilExpiry = decoded.exp - now;

            // Phase 7: 90s Clock Drift Protection
            if (timeUntilExpiry < 90) {
                logger.info(`[Auth] Token expiring in ${timeUntilExpiry}s (90s cushion). Triggering proactive refresh...`);
                try {
                    const { performRefresh } = await import('../services/api');
                    await performRefresh();
                } catch (err) {
                    logger.error('[Auth] Proactive refresh failed', err);
                }
            }
        };

        // Phase 7: Visibility-Event Refresh (Bypasses background throttling)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                logger.info('[Auth] Tab visible again. Performing proactive expiry check...');
                checkRefreshNeeded();
            }
        };

        refreshIntervalRef.current = setInterval(checkRefreshNeeded, 15000); 
        window.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
            cleanup();
            window.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [authState.authStatus, authState.token]);

    // ─── Task 4 Hardening: 5-Minute Sliding Session Heartbeat ───────────────
    useEffect(() => {
        if (authState.authStatus !== 'authenticated') return;

        const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 Minutes
        
        const runHeartbeat = async () => {
            try {
                logger.info('[Auth] Executing 5-minute session heartbeat...');
                await authService.heartbeat();
                logger.info('[Auth] Session heartbeat successful. Sliding window extended.');
            } catch (err) {
                logger.error('[Auth] Periodic heartbeat failed', err);
            }
        };

        const heartbeatId = setInterval(runHeartbeat, HEARTBEAT_INTERVAL);

        return () => clearInterval(heartbeatId);
    }, [authState.authStatus]);
    useEffect(() => {
        const handleUnauthorized = () => {
            logger.warn('[Auth] Unauthorized event detected');
            setAccessToken(null);
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('refreshToken');
            setAuthState({ user: null, token: null, authStatus: 'unauthenticated', profileImageVersion: Date.now() });
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);

        return () => {
            window.removeEventListener('auth:unauthorized', handleUnauthorized);
        };
    }, []); 

    // ─── Phase 7 Hardening: Atomic Identity Guard ──────────────────────────
    const commitAuthState = useCallback((user: User | null, token: string | null, status: AuthState['authStatus'], refreshToken?: string | null) => {
        // 1. Unified Network Sink
        setAccessToken(token);

        // 2. Unified Storage Sink
        if (token && user) {
            sessionStorage.setItem('token', token);
            if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
            sessionStorage.setItem('user', JSON.stringify(user));
        } else if (status === 'unauthenticated') {
            // ONLY clear storage if we are explicitly unauthenticated.
            // If we are 'offline', we keep the tokens in storage and retry later.
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('refreshToken');
            sessionStorage.removeItem('user');
        }


        // 3. Unified State Sink
        setAuthState({
            user,
            token,
            authStatus: status,
            profileImageVersion: Date.now()
        });
        
        logger.info(`[Auth] Identity Commit: ${status} (User: ${user?.email || 'none'})`);
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
                    const { user } = await authService.verifySession();
                    commitAuthState(user, refreshResult.token, 'authenticated', refreshResult.refreshToken);
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
        const { token: newToken, refreshToken: newRefreshToken, user: newUser } = await authService.login(credentials);
        commitAuthState(newUser, newToken, 'authenticated', newRefreshToken);
    }, [commitAuthState]);

    const signup = useCallback(async (credentials: SignupCredentials) => {
        const { token: newToken, refreshToken: newRefreshToken, user: newUser } = await authService.signup(credentials);
        commitAuthState(newUser, newToken, 'authenticated', newRefreshToken);
    }, [commitAuthState]);

    const logout = useCallback(async () => {
        commitAuthState(null, null, 'unauthenticated');

        try {
            await authService.logout();
        } catch (e) {
            logger.error('Logout failed', e);
        }
    }, [commitAuthState]);

    const refreshUser = useCallback(async () => {
        try {
            logger.info('[Auth] RefreshUser triggered. Performing session heartbeat...');
            const { user: verifiedUser } = await authService.verifySession();
            setAuthState(prev => ({
                ...prev,
                user: verifiedUser,
                profileImageVersion: Date.now()
            }));
            sessionStorage.setItem('user', JSON.stringify(verifiedUser));
            logger.info('[Auth] Heartbeat successful. Session validity synchronized.');
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
