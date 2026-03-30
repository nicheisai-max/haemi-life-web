export type UserRole = 'patient' | 'doctor' | 'admin' | 'pharmacist';

export interface User {
    id: string;
    email: string | null;
    phoneNumber: string | null;
    name: string;
    role: UserRole;
    idNumber: string | null;
    initials: string;
    profileImage: string | null;
    isVerified: boolean;
    status: string;
    createdAt: string;
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
    phoneNumber: string;
    password: string;
    name: string;
    role: UserRole;
    idNumber?: string;
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

export const isNetworkError = (error: unknown): error is NetworkError => 
    error instanceof NetworkError || (error instanceof Error && error.name === 'NetworkError');

export const isAuthError = (error: unknown): error is AuthError => 
    error instanceof AuthError || (error instanceof Error && error.name === 'AuthError');

export const isRefreshFailureError = (error: unknown): error is RefreshFailureError => 
    error instanceof RefreshFailureError || (error instanceof Error && error.name === 'RefreshFailureError');

export const isFatalAuthError = (error: unknown): error is FatalAuthError => 
    error instanceof FatalAuthError || (error instanceof Error && error.name === 'FatalAuthError');

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
