import api from './api';

// =====================================================
// USER/PROFILE API SERVICE
// =====================================================

export interface UserProfile {
    id: number;
    name: string;
    email?: string;
    phone_number: string;
    role: string;
    id_number?: string;
    status: string; // 'ACTIVE', 'INACTIVE'
    is_active?: boolean;
    profile_image: string | null;
    created_at: string;
}

export interface UpdateProfileData {
    name?: string;
    email?: string;
    phone_number?: string;
}

export interface ChangePasswordData {
    current_password: string;
    new_password: string;
}

// Get current user profile
export const getProfile = async () => {
    const response = await api.get('/auth/profile');
    return response.data as UserProfile;
};

// Update user profile
export const updateProfile = async (data: UpdateProfileData) => {
    const response = await api.put('/auth/profile', data);
    return response.data;
};

// Change password
export const changePassword = async (data: ChangePasswordData) => {
    const response = await api.put('/auth/change-password', data);
    return response.data;
};

// Upload profile image
export const uploadProfileImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post('/auth/profile-image', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export default {
    getProfile,
    updateProfile,
    changePassword,
    uploadProfileImage
};
