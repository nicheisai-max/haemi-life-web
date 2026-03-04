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
    authStatus: 'initializing' | 'authenticated' | 'unauthenticated' | 'stabilizing' | 'offline';
    profileImageVersion: number;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // ─── Deterministic Initialization Phase ──────────────────────────────────
    const initialUser = sessionStorage.getItem('user');
    const [authState, setAuthState] = useState<AuthState>({
        user: initialUser ? JSON.parse(initialUser) : null,
        token: null,
        authStatus: initialUser ? 'stabilizing' : 'initializing',
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
                        setAccessToken(null);
                        sessionStorage.removeItem('user');
                        sessionStorage.removeItem('refreshToken');
                        setAuthState({ user: null, token: null, authStatus: 'unauthenticated', profileImageVersion: Date.now() });
                    }
                }

            };
            authChannel.onmessage = handleMessage;
        }

        const handleUnauthorized = () => {
            const currentUserId = authStateRef.current.user?.id;
            setAccessToken(null);
            sessionStorage.removeItem('user');
            setAuthState({ user: null, token: null, authStatus: 'unauthenticated', profileImageVersion: Date.now() });
            if (authChannel && currentUserId) authChannel.postMessage({ type: 'LOGOUT', payload: { userId: currentUserId } });
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);

        return () => {
            if (authChannel) authChannel.close();
            window.removeEventListener('auth:unauthorized', handleUnauthorized);
        };
    }, []); // Empty deps is now safe because we use authStateRef

    // ─── Initial Boot (Authentication Discovery) ────────────────────────────
    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            try {
                // Determine if we have a stale session to "recover"
                const hasStaleSession = !!sessionStorage.getItem('user');
                if (hasStaleSession && mounted) {
                    setAuthState(prev => ({ ...prev, authStatus: 'initializing' }));
                }

                // PHASE 5: Wait for backend readiness before attempting token discovery
                // waitForBackend is already used, but we'll add 'discovering' state here
                if (mounted) setAuthState(prev => ({ ...prev, authStatus: 'initializing' }));

                const isBackendReady = await authService.waitForBackend();

                if (mounted) setAuthState(prev => ({ ...prev, authStatus: 'initializing' }));

                if (!isBackendReady) {
                    if (mounted) {
                        setAuthState({
                            user: null,
                            token: null,
                            authStatus: 'offline',
                            profileImageVersion: Date.now()
                        });
                    }
                    return;
                }

                // Discovery Stage
                if (mounted) setAuthState(prev => ({ ...prev, authStatus: 'initializing' }));

                const refreshResult = await authService.refreshToken();

                if (refreshResult.authenticated && refreshResult.token) {
                    setAccessToken(refreshResult.token);
                    if (refreshResult.refreshToken) {
                        sessionStorage.setItem('refreshToken', refreshResult.refreshToken);
                    }
                    const { user } = await authService.verifySession();

                    if (mounted) {
                        setAuthState({
                            user,
                            token: refreshResult.token,
                            authStatus: 'authenticated',
                            profileImageVersion: Date.now()
                        });
                        sessionStorage.setItem('user', JSON.stringify(user));
                    }
                } else {
                    if (mounted) {
                        setAuthState({
                            user: null,
                            token: null,
                            authStatus: 'unauthenticated',
                            profileImageVersion: Date.now()
                        });
                    }
                }
            } catch (error: unknown) {
                if (mounted) {
                    const err = error as AxiosError;
                    const isNetworkError = !err.response || err.code === 'ECONNABORTED' || err.message?.includes('Network Error');

                    if (isNetworkError) {
                        setAuthState(prev => ({ ...prev, authStatus: 'offline' }));
                    } else if (err.response?.status === 401 || err.response?.status === 403) {
                        setAuthState({ user: null, token: null, authStatus: 'unauthenticated', profileImageVersion: Date.now() });
                    } else {
                        setAuthState({ user: null, token: null, authStatus: 'unauthenticated', profileImageVersion: Date.now() });
                    }
                }
            } finally {
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

        // Multi-tab isolation: We no longer broadcast LOGIN events.
        // Each tab maintains its own unique session to support multi-role testing.

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
            isLoading: authState.authStatus === 'initializing' || authState.authStatus === 'stabilizing',
            isAuthenticated: authState.authStatus === 'authenticated',
        }}>
            {children}
        </AuthContext.Provider>
    );
};

// AuthContext and useAuth moved to AuthContextDef.ts and useAuth.ts to satisfy Fast Refresh rules.
