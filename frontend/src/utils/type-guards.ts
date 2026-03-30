import type { SocketErrorPayload, SocketErrorCode } from '../types/socket.types';
import type { User } from '../types/auth.types';
import type { JWTPayload } from '../../../backend/src/types/express'; // If available or common types

/**
 * Enterprise Hardening: Strict Type Guards (Phase 1)
 */

export function isError(value: unknown): value is Error {
    return (
        value !== null &&
        typeof value === 'object' &&
        value instanceof Error
    );
}

export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
    return typeof value === 'number';
}

export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isCustomEvent<T>(value: unknown, guard: (v: unknown) => v is T): value is CustomEvent<T> {
    return (
        value instanceof CustomEvent &&
        guard(value.detail)
    );
}

const VALID_SOCKET_ERROR_CODES: SocketErrorCode[] = [
    'AUTH_EXPIRED',
    'AUTH_INVALID',
    'TRANSPORT_FAILURE',
    'SERVER_REJECTED',
    'UNKNOWN'
];

export function isSocketErrorPayload(value: unknown): value is SocketErrorPayload {
    if (typeof value !== 'object' || value === null) return false;
    
    if ('code' in value && typeof value.code === 'string' && 'message' in value && typeof value.message === 'string') {
        const codes: readonly string[] = VALID_SOCKET_ERROR_CODES;
        return codes.includes(value.code);
    }
    return false;
}

export function isUser(value: unknown): value is User {
    if (typeof value !== 'object' || value === null) return false;
    return (
        'id' in value && typeof value.id === 'string' &&
        'email' in value && typeof value.email === 'string' &&
        'name' in value && typeof value.name === 'string' &&
        'role' in value && (value.role === 'patient' || value.role === 'doctor' || value.role === 'pharmacist' || value.role === 'admin')
    );
}

export function isJWTPayload(value: unknown): value is JWTPayload {
    if (!isObject(value)) return false;
    const { id, role, tokenVersion } = value;
    return (
        isString(id) &&
        isString(role) &&
        (role === 'patient' || role === 'doctor' || role === 'pharmacist' || role === 'admin') &&
        isNumber(tokenVersion)
    );
}

export function isHealthStatus(value: unknown): value is { status: string } {
    if (typeof value !== 'object' || value === null) return false;
    return 'status' in value && typeof (value as { status: unknown }).status === 'string';
}

// Let's avoid any even in guards if possible.
export function isHealthStatusStrict(value: unknown): value is { status: string } {
    if (!isObject(value)) return false;
    return 'status' in value && typeof value.status === 'string';
}

export function isTokenDetail(value: unknown): value is { token: string } {
    if (!isObject(value)) return false;
    return 'token' in value && typeof value.token === 'string';
}


/**
 * Enterprise Hardening: Safe JSON Parsing (Phase 2)
 */
export function safeParseJSON<T>(
    jsonString: string,
    guard: (value: unknown) => value is T
): T | null {
    try {
        const parsed: unknown = JSON.parse(jsonString);
        if (guard(parsed)) {
            return parsed;
        }
        return null;
    } catch {
        return null;
    }
}
