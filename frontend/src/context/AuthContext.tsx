import { createContext, useContext, useState, useEffect, useCallback } from 'react';

import type { User, LoginCredentials, SignupCredentials } from '../types/auth.types';
import { authService } from '../services/auth.service';
import { setAccessToken, setAppInitialized } from '../services/api';

interface AuthContextType {
    user: User | null;
    token: string | null;
    authStatus: 'initializing' | 'authenticated' | 'unauthenticated' | 'stabilizing';
    profileImageVersion: number; // increments after every refreshUser() — use as cache-bust in avatar URLs
    login: (credentials: LoginCredentials) => Promise<void>;
    signup: (credentials: SignupCredentials) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
    isLoading: boolean;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthState {
    user: User | null;
    token: string | null;
    authStatus: 'initializing' | 'authenticated' | 'unauthenticated' | 'stabilizing';
    profileImageVersion: number;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // ─── Deterministic Initialization Phase ──────────────────────────────────
    // Determine if we should start in 'initializing' or 'stabilizing' (session recovery)
    const initialUser = sessionStorage.getItem('user');
    const [authState, setAuthState] = useState<AuthState>({
        user: initialUser ? JSON.parse(initialUser) : null,
        token: null,
        authStatus: initialUser ? 'stabilizing' : 'initializing',
        profileImageVersion: Date.now()
    });

    // ─── BroadcastChannel for Cross-Tab Sync ───────────────────────────────
    useEffect(() => {
        // DEMO OVERRIDE: Prevent cross-tab auto-logouts during single-machine multi-role demos
        const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
        let authChannel: BroadcastChannel | null = null;

        if (!IS_DEMO_MODE) {
            authChannel = new BroadcastChannel('haemi_auth_sync');

            const handleMessage = (event: MessageEvent) => {
                const { type, payload } = event.data;

                if (type === 'LOGOUT') {
                    setAccessToken(null);
                    sessionStorage.removeItem('user');
                    setAuthState({ user: null, token: null, authStatus: 'unauthenticated', profileImageVersion: Date.now() });
                } else if (type === 'LOGIN') {
                    const { user, token } = payload;
                    setAccessToken(token);
                    sessionStorage.setItem('user', JSON.stringify(user));
                    setAuthState({ user, token, authStatus: 'authenticated', profileImageVersion: Date.now() });
                }
            };
            authChannel.onmessage = handleMessage;
        }

        const handleUnauthorized = () => {
            setAccessToken(null);
            sessionStorage.removeItem('user');
            setAuthState({ user: null, token: null, authStatus: 'unauthenticated', profileImageVersion: Date.now() });
            if (authChannel) authChannel.postMessage({ type: 'LOGOUT' });
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);

        return () => {
            if (authChannel) authChannel.close();
            window.removeEventListener('auth:unauthorized', handleUnauthorized);
        };
    }, []);

    // ─── Initial Boot (Authentication Discovery) ────────────────────────────
    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            try {
                // PHASE 1: Proactively attempt to refresh the token using the HttpOnly cookie.
                const refreshResult = await authService.refreshToken();

                if (refreshResult.authenticated && refreshResult.token) {
                    setAccessToken(refreshResult.token);

                    // PHASE 2: Fetch the full user profile securely with the new in-memory token.
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
            } catch (error: any) {
                if (mounted) {
                    setAuthState({
                        user: null,
                        token: null,
                        authStatus: 'unauthenticated',
                        profileImageVersion: Date.now()
                    });
                }
            } finally {
                // CRITICAL: Lift guard and notify global API buffer that we are ready
                setAppInitialized();
                window.dispatchEvent(new CustomEvent('auth:ready'));
            }
        };

        initAuth();

        return () => { mounted = false; };
    }, []);

    const login = useCallback(async (credentials: LoginCredentials) => {
        const { token: newToken, user: newUser } = await authService.login(credentials);

        setAccessToken(newToken);
        // Persist user for UI hydration if needed later (optional with this new flow)
        sessionStorage.setItem('user', JSON.stringify(newUser));

        setAuthState({ user: newUser, token: newToken, authStatus: 'authenticated', profileImageVersion: Date.now() });

        // Broadcast to other tabs
        const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
        if (!IS_DEMO_MODE) {
            const authChannel = new BroadcastChannel('haemi_auth_sync');
            authChannel.postMessage({ type: 'LOGIN', payload: { user: newUser, token: newToken } });
            authChannel.close();
        }
    }, []);

    const signup = useCallback(async (credentials: SignupCredentials) => {
        const { token: newToken, user: newUser } = await authService.signup(credentials);

        setAccessToken(newToken);
        sessionStorage.setItem('user', JSON.stringify(newUser));

        setAuthState({ user: newUser, token: newToken, authStatus: 'authenticated', profileImageVersion: Date.now() });
    }, []);

    const logout = useCallback(async () => {
        // ROBUST SYNC FLUSH: Immediately clear local state to prevent "Redirect Ping-Pong" loops.
        // This ensures components mounting on the NEXT tick (like Login) see the correct status instantly.
        setAccessToken(null);
        sessionStorage.removeItem('user');
        setAuthState({
            user: null,
            token: null,
            authStatus: 'unauthenticated',
            profileImageVersion: Date.now()
        });

        // Broadcast to other tabs
        const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
        if (!IS_DEMO_MODE) {
            const authChannel = new BroadcastChannel('haemi_auth_sync');
            authChannel.postMessage({ type: 'LOGOUT' });
            authChannel.close();
        }

        try {
            await authService.logout();
        } catch (e) {
            console.error('Logout failed (Server-side)', e);
        }
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const { user: verifiedUser } = await authService.verifySession();
            setAuthState(prev => ({
                ...prev,
                user: verifiedUser,
                profileImageVersion: Date.now() // Signal Navbar to re-fetch avatar
            }));
            sessionStorage.setItem('user', JSON.stringify(verifiedUser));
        } catch (error) {
            console.error('[Auth] Failed to refresh user:', error);
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


export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
