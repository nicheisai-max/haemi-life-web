export interface JWTPayload {
    id: string;
    email: string;
    role: 'patient' | 'doctor' | 'pharmacist' | 'admin';
    name: string;
    tokenVersion?: number;
    initials?: string | null;
    profileImage?: string | null;
    profileImageMime?: string | null;
    status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    jti: string;
    sessionId: string;
    exp?: number;
    iat?: number;
}

import { Socket } from 'socket.io';
export interface AuthenticatedSocket extends Socket {
    user: JWTPayload;
}

declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload;
        }
    }
}
