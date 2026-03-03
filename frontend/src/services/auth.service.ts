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

    verifySession: async (): Promise<{ user: User }> => {
        const response = await api.get<User & { profile: { fullName: string; avatar: string } }>('/profiles/me');
        const data = response.data;
        return {
            user: {
                ...data,
                name: data.profile.fullName,
                profile_image: data.profile.avatar,
                profile: data.profile
            }
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
                    `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/health/ready`,
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
        // Use raw axios to bypass global interceptors for the refresh token endpoint
        // This prevents loud 401 errors in the console when the user is simply not logged in
        try {
            const currentRefreshToken = sessionStorage.getItem('refreshToken');

            // Note: Since raw axios is used, we must manually unwrap the `{ success, data }` format here.
            // Our global `api.ts` interceptor does not apply to this raw `axios` call.
            const response = await axios.post<{ success?: boolean; data?: { token?: string, refreshToken?: string } }>(
                `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/refresh-token`,
                { refreshToken: currentRefreshToken }, // PATCH: Send refreshToken in body
                { withCredentials: false } // No cookies used
            );

            if (response.data.success && response.data.data?.token) {
                return {
                    token: response.data.data.token,
                    refreshToken: response.data.data.refreshToken,
                    authenticated: true
                };
            }
            return { authenticated: false };
        } catch {
            return { authenticated: false };
        }
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
