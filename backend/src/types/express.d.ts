export interface JWTPayload {
    id: string;
    email: string;
    role: 'patient' | 'doctor' | 'admin' | 'pharmacist';
}

declare global {
    namespace Express {
        export interface Request {
            user?: JWTPayload;
        }
    }
}
