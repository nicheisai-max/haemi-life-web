import axios from 'axios';
import api from './api';
import type { LoginCredentials, SignupCredentials, AuthResponse, User } from '../types/auth.types';

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
        const response = await api.get<{ user: User }>('/auth/verify');
        return response.data;
    },
    getMe: async (): Promise<{ user: User | null; authenticated: boolean }> => {
        const response = await api.get<{ user: User | null; authenticated: boolean }>('/auth/me');
        return response.data;
    },
    refreshToken: async (): Promise<{ token?: string; authenticated: boolean }> => {
        // Use raw axios to bypass global interceptors for the refresh token endpoint
        // This prevents loud 401 errors in the console when the user is simply not logged in
        const response = await axios.post<{ token?: string; authenticated: boolean }>(
            `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/refresh-token`,
            {},
            { withCredentials: true }
        );
        return response.data;
    },

    logout: async (): Promise<void> => {
        await api.post('/auth/logout');
    },

    requestPasswordReset: async (identifier: string): Promise<{ message: string; dev_otp?: string }> => {
        const response = await api.post('/password-reset/request-reset', { identifier });
        return response.data;
    },

    verifyOTP: async (identifier: string, otp: string): Promise<{ message: string; resetToken: string }> => {
        const response = await api.post('/password-reset/verify-otp', { identifier, otp });
        return response.data;
    },

    resetPassword: async (resetToken: string, newPassword: string): Promise<{ message: string }> => {
        const response = await api.post('/password-reset/reset-password', { resetToken, newPassword });
        return response.data;
    },
};
