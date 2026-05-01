import crypto from 'crypto';
import { logger } from './logger';

const ALGORITHM_GCM = 'aes-256-gcm';
const ALGORITHM_CBC = 'aes-256-cbc';
// Fail-fast at module load: a missing ENCRYPTION_KEY is a deployment
// misconfiguration that must abort startup, never default silently.
const RAW_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (typeof RAW_ENCRYPTION_KEY !== 'string' || RAW_ENCRYPTION_KEY.length === 0) {
    throw new Error('ENCRYPTION_KEY environment variable is required for institutional PII encryption');
}
const ENCRYPTION_KEY: string = RAW_ENCRYPTION_KEY;
const IV_LENGTH = 12; // Standard GCM IV length for WebCrypto compatibility
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = 'enc:';
const GCM_PREFIX = 'gcm:';
const LEGACY_IV_LENGTH = 16; // For CBC fallback

let derivedKeyCache: Buffer | null = null;

function isCipherGCM(cipher: unknown): cipher is crypto.CipherGCM {
    return typeof cipher === 'object' && cipher !== null && 'getAuthTag' in cipher;
}

function isDecipherGCM(decipher: unknown): decipher is crypto.DecipherGCM {
    return typeof decipher === 'object' && decipher !== null && 'setAuthTag' in decipher;
}

/**
 * Institutional Key Derivation (Standardized to PBKDF2)
 * Optimized with process-level caching to prevent CPU-intensive redundant hashing.
 */
function getKey(): Buffer {
    if (derivedKeyCache) return derivedKeyCache;

    let keyData: Buffer | string = ENCRYPTION_KEY;
    if (/^[0-9a-fA-F]+$/.test(ENCRYPTION_KEY)) {
        keyData = Buffer.from(ENCRYPTION_KEY, 'hex');
    }
    const salt = process.env.SECURITY_SALT || 'haemi_salt_legacy_fallback';
    
    // 🛡️ INSTITUTIONAL LOCKDOWN: 100k iterations (Google Standard)
    derivedKeyCache = crypto.pbkdf2Sync(keyData, salt, 100000, 32, 'sha256');
    logger.debug('[Security] Encryption key derived and cached');
    return derivedKeyCache;
}

/**
 * AES-256-GCM Encryption (High-Performance Authenticated Encryption)
 * Format: enc:gcm:<iv>:<tag>:<ciphertext>
 */
export const encrypt = (text: string): string => {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM_GCM, getKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
        
        if (!isCipherGCM(cipher)) {
            throw new Error('GCM cipher initialization failed');
        }

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');

        return `${ENCRYPTED_PREFIX}${GCM_PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
        logger.error('[Security] GCM Encryption failed:', {
            error: error instanceof Error ? error.message : String(error)
        });
        return text;
    }
};

/**
 * Dual-Mode Decryption (GCM + CBC Legacy + Plaintext)
 */
export const decrypt = (text: string): string => {
    if (!text || !text.startsWith(ENCRYPTED_PREFIX)) return text;

    const data = text.slice(ENCRYPTED_PREFIX.length);

    try {
        let result: string = text;
        
        // Mode A: AES-256-GCM
        if (data.startsWith(GCM_PREFIX)) {
            const parts = data.slice(GCM_PREFIX.length).split(':');
            const iv = Buffer.from(parts[0], 'hex');
            const tag = Buffer.from(parts[1], 'hex');
            const encryptedText = parts[2];

            const decipher = crypto.createDecipheriv(ALGORITHM_GCM, getKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
            
            if (!isDecipherGCM(decipher)) {
                throw new Error('GCM decipher initialization failed');
            }

            decipher.setAuthTag(tag);

            let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            result = decrypted;
        } else {
            // Mode B: Legacy AES-256-CBC
            const parts = data.split(':');
            const iv = Buffer.from(parts[0], 'hex');
            if (iv.length !== LEGACY_IV_LENGTH) {
                throw new Error('Invalid IV length for CBC');
            }
            const encryptedText = Buffer.from(parts[1], 'hex');

            const decipher = crypto.createDecipheriv(ALGORITHM_CBC, getKey(), iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            result = decrypted.toString();
        }

        return result;
    } catch (error) {
        logger.error('[Security] Decryption failed:', {
            error: error instanceof Error ? error.message : String(error),
            inputLength: text.length
        });
        // Institutional Hardening: Return sanitized placeholder for corrupted/legacy records
        return '[Encrypted Message]';
    }
};

// Blind Index helper (Deterministic HMAC for searchable PII)
export const getBlindIndex = (text: string): string => {
    if (!text) return '';
    return crypto.createHmac('sha256', getKey())
        .update(text.trim().toLowerCase())
        .digest('hex');
};
