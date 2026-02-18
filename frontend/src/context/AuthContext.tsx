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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);

    /**
     * isInitializing: true ONLY during the very first app load while we verify
     * the stored token with the backend. Once the initial check completes (success
     * or failure), this is permanently set to false for the lifetime of the session.
     *
     * CRITICAL: This flag must NEVER be set back to true after login/logout.
     * It is only used to prevent a flash of the login page on app load when
     * the user already has a valid session.
     */
    const [isInitializing, setIsInitializing] = useState<boolean>(true);

    // ─── Global unauthorized event handler ───────────────────────────────────
    // Handles 401/403 responses from any API call via the axios interceptor.
    useEffect(() => {
        const handleUnauthorized = (e: Event) => {
            const detail = (e as CustomEvent).detail || {};
            const failingToken = detail.token;
            const currentToken = localStorage.getItem('token');

            // 1. If we're already unauthenticated, there's nothing to reset.
            if (!currentToken && !user && !token) return;

            // 2. Only wipe state if the failing token matches the current one.
            // Prevents ghost rejections from stale in-flight requests.
            if (failingToken && failingToken !== currentToken) {
                console.warn('[Auth] Ignoring unauthorized event for stale token.');
                return;
            }

            console.log('[Auth] Session invalidated by server. Resetting state.');

            // Wipe everything synchronously to ensure next render is clean
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
            setIsInitializing(false);
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized as EventListener);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized as EventListener);
    }, []);

    // ─── Initial session verification (runs once on app mount) ───────────────
    useEffect(() => {
        const initSession = async () => {
            const storedToken = localStorage.getItem('token');

            if (!storedToken) {
                // No stored token — user is a guest. Done initializing.
                setIsInitializing(false);
                return;
            }

            try {
                // Verify the stored token is still valid with the backend.
                const { user: verifiedUser } = await authService.verifySession();

                // Check if the token changed while we were verifying (e.g., user
                // logged in on another tab). If so, discard this stale result.
                const currentToken = localStorage.getItem('token');
                if (storedToken !== currentToken) {
                    console.warn('[Auth] Token changed during verification. Discarding stale result.');
                    return;
                }

                // Token is valid — restore the session.
                setUser(verifiedUser);
                setToken(storedToken);
                localStorage.setItem('user', JSON.stringify(verifiedUser));
            } catch (error) {
                const storedError = error as { response?: { status: number } };
                const currentToken = localStorage.getItem('token');

                // Only clear state if the token we verified is still the current one.
                if (storedToken !== currentToken) return;

                if (storedError.response?.status === 401 || storedError.response?.status === 403) {
                    // Token is definitively invalid — clear everything.
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setToken(null);
                    setUser(null);
                } else {
                    // Network error / server down — keep the stored token for retry.
                    // The user will be re-verified on next app load.
                    console.warn('[Auth] Server unreachable during init. Keeping stored session.');
                    const cachedUser = localStorage.getItem('user');
                    if (cachedUser) {
                        try {
                            setUser(JSON.parse(cachedUser));
                            setToken(storedToken);
                        } catch {
                            // Corrupt cache — clear it.
                            localStorage.removeItem('user');
                        }
                    }
                }
            } finally {
                // Always mark initialization as complete, regardless of outcome.
                // This is the ONLY place isInitializing is set to false during startup.
                setIsInitializing(false);
            }
        };

        initSession();
    }, []); // Runs exactly once on mount.

    // ─── Login ────────────────────────────────────────────────────────────────
    const login = useCallback(async (credentials: LoginCredentials) => {
        const { token: newToken, user: newUser } = await authService.login(credentials);

        // Persist to storage FIRST so any concurrent checks see the new token.
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));

        // Update React state. These are batched by React 18 automatically.
        setToken(newToken);
        setUser(newUser);
        // isInitializing stays false — it was already set to false during initSession.
        // No need to touch it here.
    }, []);

    // ─── Signup ───────────────────────────────────────────────────────────────
    const signup = useCallback(async (credentials: SignupCredentials) => {
        const { token: newToken, user: newUser } = await authService.signup(credentials);

        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));

        setToken(newToken);
        setUser(newUser);
    }, []);

    // ─── Logout ───────────────────────────────────────────────────────────────
    const logout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
        // isInitializing stays false — no need to re-initialize.
    }, []);

    /**
     * isAuthenticated: true if and only if we have a verified user object.
     *
     * PRODUCTION RULE: This is intentionally decoupled from isInitializing.
     * After login() resolves, user is set synchronously in the same React batch.
     * isAuthenticated becomes true immediately — no race condition possible.
     *
     * isInitializing (exposed as isLoading) is ONLY used by ProtectedRoute to
     * show a loading screen during the initial app-load verification. It does
     * NOT gate isAuthenticated.
     */
    const isAuthenticated = !!user;

    return (
        <AuthContext.Provider value={{
            user,
            token,
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
