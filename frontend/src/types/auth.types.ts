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

// ─── Phase 10: Strict API Response Engine ─────────────────────────────────────
export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
    statusCode: number;
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
    [key: string]: unknown;
}

// ─── Phase 10: Error Classification System ──────────────────────────────────
export class NetworkError extends Error {
    constructor(message: string) { super(message); this.name = 'NetworkError'; }
}
export class AuthError extends Error {
    public isSilent?: boolean;
    constructor(message: string, public statusCode?: number, isSilent = false) { 
        super(message); 
        this.name = 'AuthError'; 
        this.isSilent = isSilent;
    }
}
export class TokenExpiredError extends Error {
    constructor(message: string) { super(message); this.name = 'TokenExpiredError'; }
}
export class RefreshFailureError extends Error {
    constructor(message: string, public reason?: unknown) { super(message); this.name = 'RefreshFailureError'; }
}
export class FatalAuthError extends Error {
    constructor(message: string) { super(message); this.name = 'FatalAuthError'; }
}

export const isNetworkError = (error: unknown): error is NetworkError => typeof error === 'object' && error !== null && 'name' in error && (error as Error).name === 'NetworkError';
export const isAuthError = (error: unknown): error is AuthError => typeof error === 'object' && error !== null && 'name' in error && (error as Error).name === 'AuthError';
export const isRefreshFailureError = (error: unknown): error is RefreshFailureError => typeof error === 'object' && error !== null && 'name' in error && (error as Error).name === 'RefreshFailureError';
export const isFatalAuthError = (error: unknown): error is FatalAuthError => typeof error === 'object' && error !== null && 'name' in error && (error as Error).name === 'FatalAuthError';

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
