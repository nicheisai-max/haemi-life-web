export interface JWTPayload {
    id: string;
    email: string;
    role: 'patient' | 'doctor' | 'pharmacist' | 'admin';
    name: string;
    token_version?: number;
    initials?: string;
    profile_image?: string;
    profile_image_mime?: string;
    status?: string;
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
