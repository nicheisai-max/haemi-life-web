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
};
