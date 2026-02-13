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
        const handleUnauthorized = () => {
            setUser(null);
            setToken(null);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setIsVerifying(false);
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, []);

    // ZERO-TRUST SESSION VERIFICATION
    useEffect(() => {
        const initSession = async () => {
            const storedToken = localStorage.getItem('token');

            if (!storedToken) {
                // No token found, immediate guest state
                setUser(null);
                setToken(null);
                setIsVerifying(false);
                return;
            }

            try {
                // Verify with backend
                // DO NOT trust localStorage user object
                const { user } = await authService.verifySession();

                // If successful, update state
                setUser(user);
                setToken(storedToken);
                // Update local storage with fresh user data (optional, for other tabs)
                localStorage.setItem('user', JSON.stringify(user));
            } catch (error: any) {
                console.error('Session verification failed:', error);

                // PRODUCTION FIX: Distinguish between "Unauthorized" and "Server Down"
                // If it's a 401/403, the session is definitely dead. Wipe it.
                if (error.response?.status === 401 || error.response?.status === 403) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setToken(null);
                    setUser(null);
                } else {
                    // It's likely a network error or server restart. 
                    // Keep the token for retry, but stop loading state.
                    console.warn('Server unreachable, keeping session for retry...');
                }
            } finally {
                setIsVerifying(false);
            }
        };

        initSession();
    }, []);

    const login = async (credentials: LoginCredentials) => {
        setIsVerifying(true);
        try {
            const { token, user } = await authService.login(credentials);

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));

            setToken(token);
            setUser(user);
        } catch (error) {
            console.error('Login failed', error);
            throw error;
        } finally {
            setIsVerifying(false);
        }
    };

    const signup = async (credentials: SignupCredentials) => {
        setIsVerifying(true);
        try {
            const { token, user } = await authService.signup(credentials);

            // Auto-login after signup
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));

            setToken(token);
            setUser(user);
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
