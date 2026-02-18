export type UserRole = 'patient' | 'doctor' | 'admin' | 'pharmacist';

export interface User {
    id: string;
    email: string | null;
    phone_number: string;
    name: string;
    role: UserRole;
    id_number?: string | null;
    profile_image?: string | null;
}

export interface AuthResponse {
    token: string;
    user: User;
}

export interface LoginCredentials {
    identifier: string;
    password: string;
}

export interface SignupCredentials {
    email?: string;
    phone_number: string;
    password: string;
    name: string;
    role: UserRole;
    id_number?: string;
    // Dynamic fields for other roles can be added here or in extended types
    [key: string]: any;
}
