import { JoinedDoctorRow } from '../types/db.types';
import { resolveClinicTimezone } from './timezone.utils';

export interface DoctorResponse {
    id: string;
    name: string;
    email: string | null;
    phoneNumber: string | null;
    role: string;
    initials: string;
    profileImage: string | null;
    profileImageMime: string | null;
    specialization?: string | null;
    yearsOfExperience?: number | null;
    bio?: string | null;
    consultationFee?: number | null;
    isVerified?: boolean;
    canVideoConsult?: boolean;
    // Phase 2 — Timezone Sovereignty. Always populated (falls back to the
    // institutional default if a row is read before clinic_timezone was
    // projected). Patient booking surfaces interpret slot wall-clocks
    // through this string; the doctor-side selector (Phase 3) writes it.
    clinicTimezone: string;
    createdAt?: string;
}

export const mapDoctorToResponse = (data: JoinedDoctorRow): DoctorResponse => {
    return {
        id: data.id,
        name: data.name,
        email: data.email || null,
        phoneNumber: data.phone_number,
        role: data.role || 'doctor',
        initials: data.initials,
        profileImage: data.profile_image || null,
        profileImageMime: data.profile_image_mime || null,
        specialization: data.specialization,
        yearsOfExperience: data.years_of_experience,
        bio: data.bio,
        consultationFee: data.consultation_fee ? Number(data.consultation_fee) : null,
        isVerified: !!data.is_verified,
        canVideoConsult: !!data.can_video_consult,
        clinicTimezone: resolveClinicTimezone(data.clinic_timezone),
        createdAt: data.created_at?.toISOString()
    };
};


