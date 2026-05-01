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
    profileImageMime: string | null;
    // P1 CASING FIX (Phase 12): API surface is camelCase; DB column
    // stays snake_case (sourced via user.last_activity in the mapper).
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
        // `has_consent` is optional on UserEntity (P1 type fix: it's a
        // join-derived field, not a column on `users`). Default to false
        // when the row was loaded without joining `telemedicine_consents`.
        hasConsent: user.has_consent ?? false,
        profileImage: user.profile_image ? (typeof user.profile_image === 'string' ? user.profile_image : (Buffer.isBuffer(user.profile_image) ? (user.profile_image as Buffer).toString('base64') : String(user.profile_image))) : null,
        profileImageMime: user.profile_image_mime || null,
        lastActivity: toIsoString(user.last_activity),
        createdAt: toIsoString(user.created_at) || new Date().toISOString()
    };
};
