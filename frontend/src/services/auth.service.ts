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
