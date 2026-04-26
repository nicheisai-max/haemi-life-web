import { logger } from './logger';
import { safeParseJSON, isJWTPayload, type JWTPayload } from './type-guards';

/**
 * 🔐 INSTITUTIONAL JWT DECODER (Google/Meta Grade)
 * Decodes and validates JWT payload without external library dependencies.
 * Ensures strict type safety via institutional type-guards.
 */
export const decodeJWT = (token: string | null): JWTPayload | null => {
    if (!token) return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            logger.warn('[JWT] Malformed token detected (Invalid structure)');
            return null;
        }

        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonString = atob(base64);
        
        return safeParseJSON(jsonString, isJWTPayload);
    } catch (error: unknown) {
        logger.error('[JWT] Decoding systemic failure', {
            error: error instanceof Error ? error.message : String(error)
        });
        return null;
    }
};
