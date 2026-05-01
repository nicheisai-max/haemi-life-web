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
    profile_image_mime: string | null;
    id_number: string | null;
    /**
     * P1 TYPE FIX: `users` has no `has_consent` column. This field is a
     * derived projection produced by joining `telemedicine_consents`
     * (e.g. `(tc.is_consented IS TRUE) as has_consent`). It is therefore
     * optional on the entity — present only on rows shaped by the join,
     * absent on direct `SELECT *` reads. Callers must default to `false`.
     */
    has_consent?: boolean;
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
    can_video_consult: boolean;
}

export interface MedicineEntity {
    id: number;
    name: string;
    generic_name: string | null;
    strength: string | null;
    category: string | null;
    common_uses: string | null;
    // P1 NUMERIC FIX (Phase 12): the global pg parser registered in
    // config/db.ts coerces NUMERIC columns to `number | null`. The legacy
    // `string | number` union is removed.
    price_per_unit: number | null;
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
    // P1 NUMERIC FIX: pg parser coerces NUMERIC to number | null.
    gps_latitude: number | null;
    gps_longitude: number | null;
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
    // P1 TYPE FIX (Phase 12): nullability now matches DoctorProfileEntity.
    // The previous non-null `number` here contradicted the source-of-truth
    // entity, and `mapDoctorToResponse` already coerced null safely; this
    // alignment removes the type-system lie at the cost of one type guard
    // at the consumer (which already exists).
    consultation_fee: number | null;
    is_verified: boolean;
    can_video_consult: boolean;
    license_number?: string | null;
}
