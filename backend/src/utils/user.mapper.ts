import { UserEntity } from '../types/db.types';

/**
 * Institutional Timestamp Normalization (Military Grade)
 * Guaranteed ISO-8601 UTC output from any Date or String source.
 */
const toIsoString = (val: Date | string | null | undefined): string | null => {
    if (!val) return null;
    try {
        const date = val instanceof Date ? val : new Date(val);
        return isNaN(date.getTime()) ? null : date.toISOString();
    } catch {
        return null;
    }
};

export interface UserResponse {
    id: string;
    name: string;
    email: string | null;
    phoneNumber: string | null;
    idNumber: string | null;
    role: string;
    status: string;
    initials: string;
    isVerified: boolean;
    hasConsent: boolean;
    profileImage: string | null;
    lastActivity: string | null;
    createdAt: string;
}

/**
 * Normalizes a User object from DB to camelCase API response.
 * Prevents direct data leak of DB internal fields like password or token_version.
 */
export const mapUserToResponse = (user: UserEntity): UserResponse => {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phone_number,
        idNumber: user.id_number,
        role: user.role,
        status: user.status,
        initials: user.initials,
        isVerified: user.is_verified,
        hasConsent: user.has_consent,
        profileImage: user.profile_image ? (typeof user.profile_image === 'string' ? user.profile_image : (Buffer.isBuffer(user.profile_image) ? (user.profile_image as Buffer).toString('base64') : String(user.profile_image))) : null,
        lastActivity: toIsoString(user.lastActivity),
        createdAt: toIsoString(user.created_at) || new Date().toISOString()
    };
};
