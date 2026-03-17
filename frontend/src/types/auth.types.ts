export type UserRole = 'patient' | 'doctor' | 'admin' | 'pharmacist';

export interface UserProfile {
    fullName: string;
    avatar: string | null;
    metadata: Record<string, unknown>;
}

export interface User {
    id: string;
    email: string | null;
    phone_number?: string;
    name: string;
    role: UserRole;
    id_number?: string | null;
    initials?: string;
    profile_image?: string | null;
    profile_image_mime?: string | null;
    profile?: UserProfile;
}


export interface AuthResponse {
    token: string;
    refreshToken: string;
    user: User;
    serverTime: string;
    sessionTimeout: number;
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
    [key: string]: unknown;
}

// ─── Phase 7: Strict Event Typing ───────────────────────────────────────────
export interface AuthTokenRefreshedDetail {
    token: string;
    refreshToken?: string;
    serverTime?: string;
    sessionTimeout?: number;
}

export interface AuthLogoutDetail {
    userId: string;
}

export interface SystemErrorDetail {
    message: string;
    statusCode: number;
}

export interface AuthEvents {
    'auth:token-refreshed': CustomEvent<AuthTokenRefreshedDetail>;
    'auth:unauthorized': CustomEvent<void>;
    'auth:logout': CustomEvent<AuthLogoutDetail>;
    'auth:session-expiring': CustomEvent<{ timeLeft: number }>;
    'system:error': CustomEvent<SystemErrorDetail>;
}

declare global {
    interface WindowEventMap {
        'auth:token-refreshed': AuthEvents['auth:token-refreshed'];
        'auth:unauthorized': AuthEvents['auth:unauthorized'];
        'auth:logout': AuthEvents['auth:logout'];
        'auth:session-expiring': AuthEvents['auth:session-expiring'];
        'system:error': AuthEvents['system:error'];
    }
}
