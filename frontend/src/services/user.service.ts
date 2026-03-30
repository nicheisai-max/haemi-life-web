import api, { normalizeResponse } from './api';
import type { ApiResponse } from '../types/auth.types';

// =====================================================
// USER/PROFILE API SERVICE
// =====================================================

export interface UserProfile {
    id: string;
    name: string;
    email?: string;
    phoneNumber: string;
    role: string;
    idNumber?: string;
    status: string;
    profileImage: string | null;
    createdAt: string;
}

export interface UpdateProfileData {
    name?: string;
    email?: string;
    phoneNumber?: string;
}

export interface ChangePasswordData {
    currentPassword: string;
    newPassword: string;
}

// Get current user profile
export const getProfile = async (): Promise<UserProfile> => {
    const response = await api.get<ApiResponse<UserProfile>>('/auth/profile');
    return normalizeResponse(response);
};

// Update user profile
export const updateProfile = async (data: UpdateProfileData): Promise<UserProfile> => {
    const response = await api.put<ApiResponse<UserProfile>>('/auth/profile', data);
    return normalizeResponse(response);
};

// Change password
export const changePassword = async (data: ChangePasswordData) => {
    const response = await api.put<ApiResponse<void>>('/auth/change-password', data);
    return normalizeResponse(response);
};

// Upload profile image
export const uploadProfileImage = async (file: File): Promise<UserProfile> => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post<ApiResponse<{ user: UserProfile }>>('/auth/profile-image', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return normalizeResponse(response).user;
};

export default {
    getProfile,
    updateProfile,
    changePassword,
    uploadProfileImage
};
