import { createContext, useContext, useState, useEffect, useCallback } from 'react';

import type { User, LoginCredentials, SignupCredentials } from '../types/auth.types';
import { authService } from '../services/auth.service';

interface AuthContextType {
    user: User | null;
    token: string | null;
    authStatus: 'initializing' | 'authenticated' | 'unauthenticated';
    login: (credentials: LoginCredentials) => Promise<void>;
    signup: (credentials: SignupCredentials) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
    isLoading: boolean;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

user: User | null;
token: string | null;
authStatus: 'initializing' | 'authenticated' | 'unauthenticated';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // ─── Synchronous Hydration (Frame Zero) ──────────────────────────────────
    const [authState, setAuthState] = useState<AuthState>(() => {
        const token = sessionStorage.getItem('token');
        const userStr = sessionStorage.getItem('user');

        if (token && userStr) {
            try {
                return {
                    user: JSON.parse(userStr),
                    token,
                    authStatus: 'authenticated'
                };
            } catch {
                sessionStorage.removeItem('user');
                sessionStorage.removeItem('token');
            }
        }

        return {
            user: null,
            token: null,
            authStatus: 'unauthenticated'
        };
    });

    /**
     * isVerifying: Tracks the BACKGROUND verification of the hydrated session.
     * We don't block the UI for this anymore because we hydrated synchronously.
     */
    const [isVerifying, setIsVerifying] = useState<boolean>(false);

    // ─── Global unauthorized event handler ───────────────────────────────────
    useEffect(() => {
        const handleUnauthorized = (e: Event) => {
            const detail = (e as CustomEvent).detail || {};
            const failingToken = detail.token;
            const currentToken = sessionStorage.getItem('token');

            if (!currentToken && !authState.user && !authState.token) return;

            if (failingToken !== undefined && failingToken !== currentToken) {
                console.warn('[Auth] Ignoring unauthorized event for stale token.');
                return;
            }

            console.log('[Auth] Session invalidated by server. Resetting state.');

            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            setAuthState({ user: null, token: null, authStatus: 'unauthenticated' });
            setIsVerifying(false);
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized as EventListener);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized as EventListener);
    }, [authState.user, authState.token]);

    // ─── Background Session Verification ────────────────────────────────────
    useEffect(() => {
        const verifySession = async () => {
            if (authState.authStatus !== 'authenticated' || !authState.token) return;

            setIsVerifying(true);
            try {
                const { user: verifiedUser } = await authService.verifySession();

                // Final check to ensure we aren't overwriting a newer session
                const currentToken = sessionStorage.getItem('token');
                if (authState.token !== currentToken) return;

                setAuthState(prev => ({
                    ...prev,
                    user: verifiedUser,
                    authStatus: 'authenticated'
                }));
                sessionStorage.setItem('user', JSON.stringify(verifiedUser));
            } catch (error) {
                const storedError = error as { response?: { status: number } };
                const currentToken = sessionStorage.getItem('token');

                if (authState.token !== currentToken) return;

                // Treat 401/403 as hard failures
                if (storedError.response?.status === 401 || storedError.response?.status === 403) {
                    sessionStorage.removeItem('token');
                    sessionStorage.removeItem('user');
                    setAuthState({ user: null, token: null, authStatus: 'unauthenticated' });
                }
            } finally {
                setIsVerifying(false);
            }
        };

        verifySession();
    }, []); // Only run once on mount to verify hydrated state

    const login = useCallback(async (credentials: LoginCredentials) => {
        const { token: newToken, user: newUser } = await authService.login(credentials);

        sessionStorage.setItem('token', newToken);
        sessionStorage.setItem('user', JSON.stringify(newUser));

        // Atomic state update
        setAuthState({ user: newUser, token: newToken, authStatus: 'authenticated' });
    }, []);

    const signup = useCallback(async (credentials: SignupCredentials) => {
        const { token: newToken, user: newUser } = await authService.signup(credentials);

        sessionStorage.setItem('token', newToken);
        sessionStorage.setItem('user', JSON.stringify(newUser));

        // Atomic state update
        setAuthState({ user: newUser, token: newToken, authStatus: 'authenticated' });
    }, []);

    const logout = useCallback(() => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        setAuthState({ user: null, token: null, authStatus: 'unauthenticated' });
    }, []);

    const refreshUser = useCallback(async () => {
        const storedToken = sessionStorage.getItem('token');
        if (!storedToken) return;

        try {
            const { user: verifiedUser } = await authService.verifySession();
            setAuthState(prev => ({ ...prev, user: verifiedUser }));
            sessionStorage.setItem('user', JSON.stringify(verifiedUser));
        } catch (error) {
            console.error('[Auth] Failed to refresh user:', error);
        }
    }, []);

    const isAuthenticated = !!authState.user;

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
