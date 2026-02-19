import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'); // Fallback for demo if env missing, but ideally fixed
const IV_LENGTH = 16;
const ENCRYPTED_PREFIX = 'enc:';

// Helper to ensure key is 32 bytes
function getKey() {
    return crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
}

export const encrypt = (text: string): string => {
    if (!text) return text;
    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return ENCRYPTED_PREFIX + iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (error) {
        console.error('[Security] Encryption failed:', error);
        return text; // Fail safe return original if error
    }
};

export const decrypt = (text: string): string => {
    if (!text) return text;
    if (!text.startsWith(ENCRYPTED_PREFIX)) return text; // Assume legacy plaintext

    try {
        const parts = text.slice(ENCRYPTED_PREFIX.length).split(':');
        const iv = Buffer.from(parts.shift()!, 'hex');
        const encryptedText = Buffer.from(parts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        console.error('[Security] Decryption failed:', error);
        return text; // Fail safe return original (or encrypted string if fail)
    }
};
