import { UserEntity } from '../types/db.types';
import { decrypt } from './security';

export interface UserResponse {
    id: string;
    name: string;
    email: string | null;
    phoneNumber: string | null;
    role: string;
    initials: string;
    profileImage: string | null;
    status: string;
    idNumber: string | null;
    isVerified: boolean;
    createdAt: Date;
}

export const mapUserToResponse = (user: UserEntity): UserResponse => {
    return {
        id: user.id,
        name: user.name,
        email: user.email || null,
        phoneNumber: user.phone_number ? decrypt(user.phone_number) : null,
        role: user.role,
        initials: user.initials,
        profileImage: user.profile_image || null,
        status: user.status,
        idNumber: user.id_number ? decrypt(user.id_number) : null,
        isVerified: !!user.is_verified,
        createdAt: user.created_at
    };
};

