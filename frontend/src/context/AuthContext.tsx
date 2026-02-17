import React, { createContext, useContext, useState, useEffect } from 'react';

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
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    // Default to true to prevent dashboard flash
    const [isVerifying, setIsVerifying] = useState<boolean>(true);
    // isLoading is now synonymous with isVerifying for backward compatibility, but we track verification explicitly
    const isLoading = isVerifying;

    useEffect(() => {
        const handleUnauthorized = (e: any) => {
            const failingToken = e.detail?.token;
            const currentToken = localStorage.getItem('token');

            // ATOMIC SESSION SYNC:
            // Only wipe state if the token that failed is actually the one we are currently using.
            // If failingToken is null (old behavior) or matches current, we wipe.
            // If they don't match, it's a "ghost" rejection from a previous session.
            if (failingToken && failingToken !== currentToken) {
                console.warn('Sync Conflict: Ignoring unauthorized event for stale session.');
                return;
            }

            console.log('Session invalid: Performing authenticated state reset.');
            setUser(null);
            setToken(null);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setIsVerifying(false);
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized as EventListener);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized as EventListener);
    }, []);

    // ZERO-TRUST SESSION VERIFICATION
    useEffect(() => {
        const initSession = async () => {
            const initialToken = localStorage.getItem('token');

            if (!initialToken) {
                // No token found, immediate guest state
                setUser(null);
                setToken(null);
                setIsVerifying(false);
                return;
            }

            try {
                // Verify with backend
                const { user: verifiedUser } = await authService.verifySession();

                // ATOMIC SESSION SYNC check:
                // If the token changed during the verification request (e.g. user logged in manually),
                // do NOT overwrite the new session data with this background result.
                const currentToken = localStorage.getItem('token');
                if (initialToken !== currentToken) {
                    console.warn('Sync Conflict: Session verification finished for a discarded token.');
                    return;
                }

                setUser(verifiedUser);
                setToken(initialToken);
                localStorage.setItem('user', JSON.stringify(verifiedUser));
            } catch (error: any) {
                console.error('Session verification failed:', error);

                // ATOMIC SESSION SYNC check for failure path
                const currentToken = localStorage.getItem('token');
                if (initialToken !== currentToken) return;

                if (error.response?.status === 401 || error.response?.status === 403) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setToken(null);
                    setUser(null);
                } else {
                    console.warn('Server unreachable, keeping session for retry...');
                }
            } finally {
                // Final safety check before ending loading state
                const currentToken = localStorage.getItem('token');
                if (initialToken === currentToken) {
                    setIsVerifying(false);
                }
            }
        };

        initSession();
    }, []);

    const login = async (credentials: LoginCredentials) => {
        // When manual login starts, we don't necessarily want to set isVerifying=true 
        // if it's already verifying, but we do want to ensure the UI shows a loader.
        try {
            const { token: newToken, user: newUser } = await authService.login(credentials);

            // Manual login always takes precedence. We set these first to 
            // trigger the Atomic Sync mismatch in any pending background tasks.
            localStorage.setItem('token', newToken);
            localStorage.setItem('user', JSON.stringify(newUser));

            setToken(newToken);
            setUser(newUser);
        } catch (error) {
            console.error('Login failed', error);
            throw error;
        } finally {
            setIsVerifying(false);
        }
    };

    const signup = async (credentials: SignupCredentials) => {
        try {
            const { token: newToken, user: newUser } = await authService.signup(credentials);

            localStorage.setItem('token', newToken);
            localStorage.setItem('user', JSON.stringify(newUser));

            setToken(newToken);
            setUser(newUser);
        } catch (error) {
            console.error('Signup failed', error);
            throw error;
        } finally {
            setIsVerifying(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
        // Clear verify state
        setIsVerifying(false);
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            login,
            signup,
            logout,
            isLoading, // Kept for backward compat, mapped to isVerifying
            isAuthenticated: !!user && !isVerifying, // Only true if user exists AND verified
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
