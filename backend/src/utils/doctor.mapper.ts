import { JoinedDoctorRow } from '../types/db.types';
import { decrypt } from './security';

export interface DoctorResponse {
    id: string;
    name: string;
    email: string | null;
    phoneNumber: string | null;
    role: string;
    initials: string;
    profileImage: string | null;
    specialization?: string | null;
    yearsOfExperience?: number | null;
    bio?: string | null;
    consultationFee?: number | null;
    isVerified?: boolean;
}

export const mapDoctorToResponse = (data: JoinedDoctorRow): DoctorResponse => {
    return {
        id: data.id,
        name: data.name,
        email: data.email || null,
        phoneNumber: data.phone_number ? decrypt(data.phone_number) : null,
        role: data.role || 'doctor',
        initials: data.initials,
        profileImage: data.profile_image || null,
        specialization: data.specialization,
        yearsOfExperience: data.years_of_experience,
        bio: data.bio,
        consultationFee: data.consultation_fee ? Number(data.consultation_fee) : null,
        isVerified: !!data.is_verified
    };
};


