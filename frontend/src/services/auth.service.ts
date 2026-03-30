import axios from 'axios';
import api, { normalizeResponse } from './api';
import { logger } from '../utils/logger';
import type { LoginCredentials, SignupCredentials, AuthResponse, User, ApiResponse } from '../types/auth.types';

// Track backend check status for UI (optional, can be exported if needed)
let isCheckingBackend = false;
export const getIsCheckingBackend = () => isCheckingBackend;
const setIsCheckingBackend = (status: boolean) => { isCheckingBackend = status; };

export const authService = {
    login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
        const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', credentials);
        return normalizeResponse(response);
    },


    signup: async (credentials: SignupCredentials): Promise<AuthResponse> => {
        const response = await api.post<ApiResponse<AuthResponse>>('/auth/signup', credentials);
        return normalizeResponse(response);
    },

    verifySession: async (): Promise<{ user: User; serverTime: string; sessionTimeout: number }> => {
        const response = await api.get<ApiResponse<{ 
            user: User;
            serverTime: string;
            sessionTimeout: number;
        }>>('/auth/verify');
        const data = normalizeResponse(response);
        
        return {
            user: data.user,
            serverTime: data.serverTime,
            sessionTimeout: data.sessionTimeout
        };
    },

    getMe: async (): Promise<{ user: User | null; authenticated: boolean }> => {
        try {
            const response = await api.get<ApiResponse<User>>('/profiles/me');
            const user = normalizeResponse(response);
            if (!user) return { user: null, authenticated: false };

            return {
                user,
                authenticated: true
            };
        } catch (error: unknown) {
            logger.error('[AuthService] getMe failed:', error instanceof Error ? error.message : String(error));
            return { user: null, authenticated: false };
        }
    },
    waitForBackend: async (maxRetries = 8, baseInterval = 1000): Promise<boolean> => {
        setIsCheckingBackend(true);
        let interval = baseInterval;
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await axios.get(
                    `${import.meta.env.VITE_API_URL || ''}/api/health/ready`,
                    { timeout: 3000 }
                );
                if (response.status === 200) {
                    setIsCheckingBackend(false);
                    return true;
                }
            } catch {
                await new Promise(r => setTimeout(r, interval));
                interval = Math.min(interval * 1.5, 5000); // Exponential backoff capped at 5s
            }
        }
        setIsCheckingBackend(false);
        return false;
    },

    refreshToken: async (): Promise<{ token?: string; refreshToken?: string; authenticated: boolean }> => {
        // Refactored to use the synchronized refresh logic from api.ts
        // This ensures the Refresh Mutex is respected even for manual calls.
        const { performRefresh } = await import('./api');
        const token = await performRefresh();
        
        if (token) {
            return {
                token,
                refreshToken: sessionStorage.getItem('refreshToken') || undefined,
                authenticated: true
            };
        }
        return { authenticated: false };
    },

    logout: async (): Promise<void> => {
        await api.post<ApiResponse<void>>('/auth/logout');
    },

    requestPasswordReset: async (identifier: string): Promise<{ message: string; devOtp?: string }> => {
        const response = await api.post<ApiResponse<{ message: string; devOtp?: string }>>('/password-reset/request-reset', { identifier });
        return normalizeResponse(response);
    },

    verifyOTP: async (identifier: string, otp: string): Promise<{ message: string; resetToken: string }> => {
        const response = await api.post<ApiResponse<{ message: string; resetToken: string }>>('/password-reset/verify-otp', { identifier, otp });
        return normalizeResponse(response);
    },

    resetPassword: async (resetToken: string, newPassword: string): Promise<{ message: string }> => {
        const response = await api.post<ApiResponse<{ message: string }>>('/password-reset/reset-password', { resetToken, newPassword });
        return normalizeResponse(response);
    },
};
