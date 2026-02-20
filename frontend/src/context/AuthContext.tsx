import { createContext, useContext, useState, useEffect, useCallback } from 'react';

import type { User, LoginCredentials, SignupCredentials } from '../types/auth.types';
import { authService } from '../services/auth.service';
import { setAccessToken } from '../services/api';

interface AuthContextType {
    user: User | null;
    token: string | null; // Keeps 'token' interface for compatibility, but it's just state now
    authStatus: 'initializing' | 'authenticated' | 'unauthenticated';
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
    authStatus: 'initializing' | 'authenticated' | 'unauthenticated';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // ─── Deterministic Initialization Phase ──────────────────────────────────
    const [authState, setAuthState] = useState<AuthState>({
        user: null, // Initially null. We do NOT trust storage blindly.
        token: null,
        authStatus: 'initializing' // Always start initializing
    });

    // ─── Global unauthorized event handler ───────────────────────────────────
    useEffect(() => {
        const handleUnauthorized = () => {
            console.log('[Auth] Session invalidated (Global Event).');
            setAccessToken(null);
            sessionStorage.removeItem('user');
            setAuthState({ user: null, token: null, authStatus: 'unauthenticated' });
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, []);

    // ─── Initial Boot (Silent Refresh) ──────────────────────────────────────
    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            try {
                // Attempt to refresh token using HTTP-Only cookie
                // Backend now returns 200 OK with { authenticated: false } for guests to keep console clean
                const response = await authService.refreshToken();

                if (!response.authenticated || !response.token) {
                    console.log('[Auth] Guest user: No active session found.');
                    if (mounted) {
                        setAuthState({
                            user: null,
                            token: null,
                            authStatus: 'unauthenticated'
                        });
                    }
                    return; // Stop initialization cleanly
                }

                // If successful, we get a new access token
                setAccessToken(response.token);

                // We can hydrate user from sessionStorage for UI speed, 
                // OR fetch profile. Let's start with verifying session to get fresh user data.
                const { user } = await authService.verifySession();

                if (mounted) {
                    setAuthState({
                        user,
                        token: response.token,
                        authStatus: 'authenticated'
                    });
                }
            } catch (error: any) {
                // Normal flow: User is simply not logged in (or session expired)
                // We only log if it's NOT a standard 401 Unauthorized, to keep the console clean for unauthenticated users.
                if (error?.response?.status !== 401) {
                    console.error('[Auth] Session initialization error:', error);
                } else {
                    console.log('[Auth] No active session found on boot.');
                }

                if (mounted) {
                    setAuthState({
                        user: null, // Clear user even if storage had it
                        token: null,
                        authStatus: 'unauthenticated'
                    });
                }
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

        setAuthState({ user: newUser, token: newToken, authStatus: 'authenticated' });
    }, []);

    const signup = useCallback(async (credentials: SignupCredentials) => {
        const { token: newToken, user: newUser } = await authService.signup(credentials);

        setAccessToken(newToken);
        sessionStorage.setItem('user', JSON.stringify(newUser));

        setAuthState({ user: newUser, token: newToken, authStatus: 'authenticated' });
    }, []);

    const logout = useCallback(async () => {
        // ROBUST SYNC FLUSH: Immediately clear local state to prevent "Redirect Ping-Pong" loops.
        // This ensures components mounting on the NEXT tick (like Login) see the correct status instantly.
        setAccessToken(null);
        sessionStorage.removeItem('user');
        setAuthState({
            user: null,
            token: null,
            authStatus: 'unauthenticated'
        });

        try {
            await authService.logout();
        } catch (e) {
            console.error('Logout failed (Server-side)', e);
        }
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const { user: verifiedUser } = await authService.verifySession();
            setAuthState(prev => ({ ...prev, user: verifiedUser }));
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
            login,
            signup,
            logout,
            refreshUser,
            isLoading: authState.authStatus === 'initializing',
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
