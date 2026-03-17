import axios from 'axios';
import api from './api';
import type { LoginCredentials, SignupCredentials, AuthResponse, User } from '../types/auth.types';

// Track backend check status for UI (optional, can be exported if needed)
let isCheckingBackend = false;
export const getIsCheckingBackend = () => isCheckingBackend;
const setIsCheckingBackend = (status: boolean) => { isCheckingBackend = status; };

export const authService = {
    login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
        const response = await api.post<AuthResponse>('/auth/login', credentials);
        return response.data;
    },


    signup: async (credentials: SignupCredentials): Promise<AuthResponse> => {
        const response = await api.post<AuthResponse>('/auth/signup', credentials);
        return response.data;
    },

    verifySession: async (): Promise<{ user: User; serverTime: string; sessionTimeout: number }> => {
        const response = await api.get<{ 
            user: User & { profile: { fullName: string; avatar: string } };
            serverTime: string;
            sessionTimeout: number;
        }>('/auth/verify');
        const data = response.data;
        return {
            user: {
                ...data.user,
                name: data.user.profile?.fullName || data.user.name,
                profile_image: data.user.profile?.avatar || data.user.profile_image
            },
            serverTime: data.serverTime,
            sessionTimeout: data.sessionTimeout
        };
    },

    getMe: async (): Promise<{ user: User | null; authenticated: boolean }> => {
        try {
            const response = await api.get<User & { profile: { fullName: string; avatar: string } }>('/profiles/me');
            const data = response.data;
            if (!data) return { user: null, authenticated: false };

            return {
                user: {
                    ...data,
                    name: data.profile.fullName,
                    profile_image: data.profile.avatar,
                    profile: data.profile
                },
                authenticated: true
            };
        } catch {
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
        await api.post('/auth/logout');
    },

    requestPasswordReset: async (identifier: string): Promise<{ message: string; dev_otp?: string }> => {
        const response = await api.post<{ message: string; dev_otp?: string }>('/password-reset/request-reset', { identifier });
        return response.data;
    },

    verifyOTP: async (identifier: string, otp: string): Promise<{ message: string; resetToken: string }> => {
        const response = await api.post<{ message: string; resetToken: string }>('/password-reset/verify-otp', { identifier, otp });
        return response.data;
    },

    resetPassword: async (resetToken: string, newPassword: string): Promise<{ message: string }> => {
        const response = await api.post<{ message: string }>('/password-reset/reset-password', { resetToken, newPassword });
        return response.data;
    },
};
