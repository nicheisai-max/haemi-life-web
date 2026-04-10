/**
 * HAEMI LIFE: Database Entity Types
 * "Institutional Data Contracts"
 */

export type UserRole = 'patient' | 'doctor' | 'admin' | 'pharmacist';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_DELETION';

export interface UserEntity {
    id: string;
    name: string;
    email: string | null;
    phone_number: string;
    password?: string; // password_hash
    role: UserRole;
    status: UserStatus;
    token_version: number;
    initials: string;
    is_verified: boolean;
    is_active?: boolean; // Legacy
    profile_image: string | null;
    profile_image_mime?: string | null;
    id_number: string | null;
    has_consent: boolean;
    last_activity: Date | string | null;
    created_at: Date;
    updated_at: Date;
}

export interface DoctorProfileEntity {
    id: number;
    user_id: string;
    specialization: string | null;
    license_number: string | null;
    years_of_experience: number | null;
    bio: string | null;
    consultation_fee: number | null;
    is_verified: boolean;
    profile_image: string | null;
}

export interface MedicineEntity {
    id: number;
    name: string;
    generic_name: string | null;
    strength: string | null;
    category: string | null;
    common_uses: string | null;
    price_per_unit: string | number;
}

export interface PharmacyEntity {
    id: number;
    name: string;
    location_id: number | null;
    address: string | null;
    phone_number: string | null;
    email: string | null;
}

export interface LocationEntity {
    id: number;
    city: string;
    district: string | null;
    gps_latitude: string | number | null;
    gps_longitude: string | number | null;
}

export interface UserSessionEntity {
    id: string;
    user_id: string;
    user_role: string;
    session_id: string;
    access_token_jti: string | null;
    refresh_token_jti: string | null;
    previous_refresh_token_jti: string | null;
    previous_access_token_jti: string | null;
    jti_rotated_at: Date | string | null;
    ip_address: string | null;
    user_agent: string | null;
    last_activity: Date | string | null;
    revoked: boolean;
    expires_at: Date | null;
}

export interface JoinedDoctorRow extends UserEntity {
    specialization: string | null;
    years_of_experience: number | null;
    bio: string | null;
    consultation_fee: number;
    is_verified: boolean;
    license_number?: string | null;
}
