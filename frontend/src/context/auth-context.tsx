import { useState, useEffect, useCallback, useRef } from 'react';
import { AxiosError } from 'axios';
import { logger } from '../utils/logger';
import { authService } from '../services/auth.service';
import { setAccessToken, setAppInitialized } from '../services/api';
import { AuthContext } from './auth-context-def';
import type { User, LoginCredentials, SignupCredentials } from '../types/auth.types';

interface AuthState {
    user: User | null;
    token: string | null;
    authStatus: 'booting' | 'auth_check' | 'onboarding_check' | 'authenticated' | 'unauthenticated' | 'offline' | 'app_ready';
    profileImageVersion: number;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // ─── Deterministic Initialization Phase ──────────────────────────────────
    const initialUser = sessionStorage.getItem('user');
    // Phase 4: Frontend Initialization Stabilization
    const booted = useRef(false);

    const [authState, setAuthState] = useState<AuthState>({
        user: initialUser ? JSON.parse(initialUser) : null,
        token: null,
        authStatus: 'booting',
        profileImageVersion: Date.now()
    });

    // FIX 2: Ref-based State Tracking to prevent stale closures in event listeners
    const authStateRef = useRef<AuthState>(authState);
    useEffect(() => {
        authStateRef.current = authState;
    }, [authState]);

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
                        logger.info('[AuthSync] Logout received from other tab');
                        setAccessToken(null);
                        sessionStorage.removeItem('user');
                        sessionStorage.removeItem('refreshToken');
                        setAuthState({ user: null, token: null, authStatus: 'unauthenticated', profileImageVersion: Date.now() });
                    }
                }

                if (type === 'LOGIN_SYNC') {
                    logger.info('[AuthSync] Login received from other tab');
                    setAccessToken(payload.token);
                    sessionStorage.setItem('refreshToken', payload.refreshToken);
                    sessionStorage.setItem('user', JSON.stringify(payload.user));
                    setAuthState({
                        user: payload.user,
                        token: payload.token,
                        authStatus: 'authenticated',
                        profileImageVersion: Date.now()
                    });
                }
            };
            authChannel.onmessage = handleMessage;
        }

        const handleUnauthorized = () => {
            const currentUserId = authStateRef.current.user?.id;
            logger.warn('[Auth] Unauthorized event detected');
            setAccessToken(null);
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('refreshToken'); // Added this line for consistency with logout
            setAuthState({ user: null, token: null, authStatus: 'unauthenticated', profileImageVersion: Date.now() });
            if (authChannel && currentUserId) authChannel.postMessage({ type: 'LOGOUT', payload: { userId: currentUserId } });
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);

        return () => {
            if (authChannel) authChannel.close();
            window.removeEventListener('auth:unauthorized', handleUnauthorized);
        };
    }, []); // Empty deps is now safe because we use authStateRef

    // ─── Initial Boot (Authentication Discovery State Machine) ──────────────────
    useEffect(() => {
        let mounted = true;
        const BOOT_TIMEOUT = 15000; // 15s absolute guard

        const initAuth = async () => {
            const timeoutGuard = setTimeout(() => {
                if (authStateRef.current.authStatus !== 'app_ready') {
                    logger.error('[Boot] Deadlock detected: Boot timeout reached');
                    setAuthState(prev => ({ ...prev, authStatus: 'app_ready' }));
                    setAppInitialized();
                }
            }, BOOT_TIMEOUT);

            try {
                logger.info('[Boot] BOOT_STARTED');
                // STATE: BOOTING -> AUTH_CHECK
                setAuthState(prev => ({ ...prev, authStatus: 'auth_check' }));

                const isBackendReady = await authService.waitForBackend(5, 1000); // Reduce retries for boot speed
                if (!isBackendReady) {
                    logger.warn('[Boot] Backend unreachable');
                    setAuthState(prev => ({ ...prev, user: null, token: null, authStatus: 'offline' }));
                    return;
                }

                // Discovery Stage: Attempt Session Recovery
                logger.info('[Boot] AUTH_CHECK_STARTED');
                const refreshResult = await authService.refreshToken();

                if (refreshResult.authenticated && refreshResult.token) {
                    setAccessToken(refreshResult.token);
                    if (refreshResult.refreshToken) {
                        sessionStorage.setItem('refreshToken', refreshResult.refreshToken);
                    }

                    const { user } = await authService.verifySession();

                    setAuthState({
                        user,
                        token: refreshResult.token,
                        authStatus: 'authenticated',
                        profileImageVersion: Date.now()
                    });
                    sessionStorage.setItem('user', JSON.stringify(user));
                    logger.info('[Boot] AUTH_CHECK_COMPLETED: Authenticated');
                } else {
                    logger.info('[Boot] AUTH_CHECK_COMPLETED: Unauthenticated');
                    setAuthState(prev => ({
                        ...prev,
                        user: null,
                        token: null,
                        authStatus: 'unauthenticated'
                    }));
                }

                // STATE: AUTH_CHECK -> ONBOARDING_CHECK
                // Note: Transitioning to app_ready as onboarding is handled by FirstVisitGuard 
                // but we honor the design by ensuring a terminal settlement.
                setAuthState(prev => ({ ...prev, authStatus: 'app_ready' }));
                logger.info('[Boot] APP_READY');

            } catch (error: unknown) {
                logger.error('[Boot] Initialization failure', error);
                // const err = error as AxiosError;
                // const isNetworkError = !err.response || err.code === 'ECONNABORTED' || err.message?.includes('Network Error');

                setAuthState(prev => ({
                    ...prev,
                    user: null,
                    token: null,
                    authStatus: 'unauthenticated' // isNetworkError ? 'offline' : 'unauthenticated'
                }));

                // Even on error, we must reach app_ready to clear loader
                setAuthState(prev => ({ ...prev, authStatus: 'app_ready' }));
            } finally {
                clearTimeout(timeoutGuard);
                setAppInitialized();
                window.dispatchEvent(new CustomEvent('auth:ready'));
            }
        };

        initAuth();
        return () => { mounted = false; };
    }, []);

    const login = useCallback(async (credentials: LoginCredentials) => {
        const { token: newToken, refreshToken: newRefreshToken, user: newUser } = await authService.login(credentials);
        setAccessToken(newToken);
        sessionStorage.setItem('refreshToken', newRefreshToken);
        sessionStorage.setItem('user', JSON.stringify(newUser));
        setAuthState({ user: newUser, token: newToken, authStatus: 'authenticated', profileImageVersion: Date.now() });

        // CROSS-TAB SYNC: Broadcast login
        const authChannel = new BroadcastChannel('haemi_auth_sync');
        authChannel.postMessage({
            type: 'LOGIN_SYNC',
            payload: { user: newUser, token: newToken, refreshToken: newRefreshToken }
        });
        authChannel.close();

    }, []);

    const signup = useCallback(async (credentials: SignupCredentials) => {
        const { token: newToken, refreshToken: newRefreshToken, user: newUser } = await authService.signup(credentials);
        setAccessToken(newToken);
        sessionStorage.setItem('refreshToken', newRefreshToken);
        sessionStorage.setItem('user', JSON.stringify(newUser));
        setAuthState({ user: newUser, token: newToken, authStatus: 'authenticated', profileImageVersion: Date.now() });
    }, []);

    const logout = useCallback(async () => {
        const currentUserId = authStateRef.current.user?.id;
        setAccessToken(null);
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('refreshToken');
        setAuthState({ user: null, token: null, authStatus: 'unauthenticated', profileImageVersion: Date.now() });

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
    }, []);

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
            isLoading: authState.authStatus === 'booting' ||
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
