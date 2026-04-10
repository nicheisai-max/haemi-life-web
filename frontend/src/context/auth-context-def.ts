import { createContext } from 'react';
import type { User, LoginCredentials, SignupCredentials } from '../types/auth.types';

export interface AuthContextType {
    user: User | null;
    token: string | null;
    authStatus: 'initializing' | 'auth_check' | 'onboarding_check' | 'authenticated' | 'unauthenticated' | 'offline' | 'app_ready';
    profileImageVersion: number;
    login: (credentials: LoginCredentials) => Promise<void>;
    signup: (credentials: SignupCredentials) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
    isRefreshing: boolean;
    isTokenNearDeath: boolean;
    isLoading: boolean;
    isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
export type { User, LoginCredentials, SignupCredentials };
