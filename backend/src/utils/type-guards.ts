import { JWTPayload } from '../types/express';

export interface RefreshJWTPayload {
    id: string;
    tokenVersion: number;
    jti: string;
    sessionId: string;
}

/**
 * Validates that an unknown object matches the JWTPayload structure.
 * Zero-Tolerance compliant: Uses pure narrowing with no assertions.
 */
export function isJWTPayload(payload: unknown): payload is JWTPayload {
    if (typeof payload !== 'object' || payload === null) return false;
    
    return (
        'id' in payload && typeof (payload as { id: unknown }).id === 'string' &&
        'email' in payload && typeof (payload as { email: unknown }).email === 'string' &&
        'role' in payload && typeof (payload as { role: unknown }).role === 'string' &&
        'sessionId' in payload && typeof (payload as { sessionId: unknown }).sessionId === 'string' &&
        'jti' in payload && typeof (payload as { jti: unknown }).jti === 'string' &&
        ['patient', 'doctor', 'pharmacist', 'admin'].includes((payload as { role: string }).role)
    );
}

export function isJWTPayloadStrict(payload: unknown): payload is JWTPayload {
    if (typeof payload !== 'object' || payload === null) return false;
    
    const p = payload as Record<string, unknown>;
    const hasId = 'id' in p && typeof p.id === 'string';
    const hasEmail = 'email' in p && typeof p.email === 'string';
    const hasSessionId = 'sessionId' in p && typeof p.sessionId === 'string';
    const hasJti = 'jti' in p && typeof p.jti === 'string';
    const validRoles = ['patient', 'doctor', 'pharmacist', 'admin'];
    const hasRole = 'role' in p && typeof p.role === 'string' && validRoles.includes(p.role as string);
    
    return hasId && hasEmail && hasRole && hasSessionId && hasJti;
}

export function isRefreshJWTPayload(payload: unknown): payload is RefreshJWTPayload {
    if (typeof payload !== 'object' || payload === null) return false;
    
    const p = payload as Record<string, unknown>;
    const hasId = 'id' in p && typeof p.id === 'string';
    const hasJti = 'jti' in p && typeof p.jti === 'string';
    const hasSessionId = 'sessionId' in p && typeof p.sessionId === 'string';
    const hasTokenVersion = 'tokenVersion' in p && typeof p.tokenVersion === 'number';
    
    return hasId && hasJti && hasSessionId && hasTokenVersion;
}
