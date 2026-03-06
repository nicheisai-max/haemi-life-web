import crypto from 'crypto';

const ALGORITHM_GCM = 'aes-256-gcm';
const ALGORITHM_CBC = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const IV_LENGTH = 12; // Standard GCM IV length for WebCrypto compatibility
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = 'enc:';
const GCM_PREFIX = 'gcm:';
const LEGACY_IV_LENGTH = 16; // For CBC fallback

// Helper to ensure key is 32 bytes
// Standardized to PBKDF2 for production-grade compatibility with Web Crypto API (Frontend)
function getKey() {
    let keyData: Buffer | string = ENCRYPTION_KEY;
    if (/^[0-9a-fA-F]+$/.test(ENCRYPTION_KEY)) {
        keyData = Buffer.from(ENCRYPTION_KEY, 'hex');
    }
    const salt = process.env.SECURITY_SALT || 'haemi_salt_legacy_fallback';
    return crypto.pbkdf2Sync(keyData, salt, 100000, 32, 'sha256');
}

/**
 * AES-256-GCM Encryption (High-Performance Authenticated Encryption)
 * Format: enc:gcm:<iv>:<tag>:<ciphertext>
 */
export const encrypt = (text: string): string => {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM_GCM, getKey(), iv, { authTagLength: AUTH_TAG_LENGTH }) as crypto.CipherGCM;

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');

        return `${ENCRYPTED_PREFIX}${GCM_PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
        console.error('[Security] GCM Encryption failed:', error);
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

            const decipher = crypto.createDecipheriv(ALGORITHM_GCM, getKey(), iv, { authTagLength: AUTH_TAG_LENGTH }) as crypto.DecipherGCM;
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
        console.error('[Security] Decryption failed (Mode mismatch or key error):', error);
        return text;
    }
};

// Blind Index helper (Deterministic HMAC for searchable PII)
export const getBlindIndex = (text: string): string => {
    if (!text) return '';
    return crypto.createHmac('sha256', getKey())
        .update(text.trim().toLowerCase())
        .digest('hex');
};
