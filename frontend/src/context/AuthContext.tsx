import { createContext, useContext, useState, useEffect, useCallback } from 'react';

import type { User, LoginCredentials, SignupCredentials } from '../types/auth.types';
import { authService } from '../services/auth.service';

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (credentials: LoginCredentials) => Promise<void>;
    signup: (credentials: SignupCredentials) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthState {
    user: User | null;
    token: string | null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [authState, setAuthState] = useState<AuthState>({
        user: null,
        token: null
    });

    /**
     * isInitializing: true ONLY during the very first app load while we verify
     * the stored token with the backend. Once the initial check completes (success
     * or failure), this is permanently set to false for the lifetime of the session.
     */
    const [isInitializing, setIsInitializing] = useState<boolean>(true);

    // ─── Global unauthorized event handler ───────────────────────────────────
    useEffect(() => {
        const handleUnauthorized = (e: Event) => {
            const detail = (e as CustomEvent).detail || {};
            const failingToken = detail.token;
            const currentToken = localStorage.getItem('token');

            if (!currentToken && !authState.user && !authState.token) return;

            if (failingToken && failingToken !== currentToken) {
                console.warn('[Auth] Ignoring unauthorized event for stale token.');
                return;
            }

            console.log('[Auth] Session invalidated by server. Resetting state.');

            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setAuthState({ user: null, token: null });
            setIsInitializing(false);
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized as EventListener);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized as EventListener);
    }, [authState.user, authState.token]);

    // ─── Initial session verification (runs once on app mount) ───────────────
    useEffect(() => {
        const initSession = async () => {
            const storedToken = localStorage.getItem('token');

            if (!storedToken) {
                setIsInitializing(false);
                return;
            }

            try {
                const { user: verifiedUser } = await authService.verifySession();
                const currentToken = localStorage.getItem('token');

                if (storedToken !== currentToken) {
                    console.warn('[Auth] Token changed during verification. Discarding stale result.');
                    return;
                }

                setAuthState({ user: verifiedUser, token: storedToken });
                localStorage.setItem('user', JSON.stringify(verifiedUser));
            } catch (error) {
                const storedError = error as { response?: { status: number } };
                const currentToken = localStorage.getItem('token');

                if (storedToken !== currentToken) return;

                if (storedError.response?.status === 401 || storedError.response?.status === 403) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setAuthState({ user: null, token: null });
                } else {
                    console.warn('[Auth] Server unreachable during init. Keeping stored session.');
                    const cachedUser = localStorage.getItem('user');
                    if (cachedUser) {
                        try {
                            setAuthState({ user: JSON.parse(cachedUser), token: storedToken });
                        } catch {
                            localStorage.removeItem('user');
                        }
                    }
                }
            } finally {
                setIsInitializing(false);
            }
        };

        initSession();
    }, []);

    const login = useCallback(async (credentials: LoginCredentials) => {
        const { token: newToken, user: newUser } = await authService.login(credentials);

        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));

        // Atomic state update
        setAuthState({ user: newUser, token: newToken });
    }, []);

    const signup = useCallback(async (credentials: SignupCredentials) => {
        const { token: newToken, user: newUser } = await authService.signup(credentials);

        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));

        // Atomic state update
        setAuthState({ user: newUser, token: newToken });
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setAuthState({ user: null, token: null });
    }, []);

    const isAuthenticated = !!authState.user;

    return (
        <AuthContext.Provider value={{
            user: authState.user,
            token: authState.token,
            login,
            signup,
            logout,
            isLoading: isInitializing,
            isAuthenticated,
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
