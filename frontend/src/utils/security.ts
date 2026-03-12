const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY;
const SECURITY_SALT = import.meta.env.VITE_SECURITY_SALT;
const PBKDF2_ITERATIONS = parseInt(import.meta.env.VITE_PBKDF2_ITERATIONS || '100000');
const KEY_LENGTH = parseInt(import.meta.env.VITE_KEY_LENGTH || '32');

if (!ENCRYPTION_KEY) {
    console.error('[Security] CRITICAL: VITE_ENCRYPTION_KEY is missing. Decryption will fail.');
}
if (!SECURITY_SALT) {
    console.warn('[Security] WARNING: VITE_SECURITY_SALT is missing. Falling back to insecure default.');
}

const ALGORITHM_GCM = 'AES-GCM';
const ALGORITHM_CBC = 'AES-CBC';
const IV_LENGTH_GCM = 12; // WebCrypto GCM Standard
const ENCRYPTED_PREFIX = 'enc:';
const GCM_PREFIX = 'gcm:';

/**
 * Derives a cryptographic key from the password using PBKDF2.
 */
async function deriveKey(algorithm: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();

    if (!ENCRYPTION_KEY) {
        throw new Error('🔥 SECURITY ARCHITECTURE BLOCK: VITE_ENCRYPTION_KEY is mandatory.');
    }

    let keyData: Uint8Array;
    if (/^[0-9a-fA-F]+$/.test(ENCRYPTION_KEY)) {
        const matches = ENCRYPTION_KEY.match(/.{1,2}/g);
        keyData = new Uint8Array(matches!.map((byte: string) => parseInt(byte, 16)));
    } else {
        keyData = encoder.encode(ENCRYPTION_KEY);
    }

    const saltData = encoder.encode(SECURITY_SALT || 'haemi_salt');

    const baseKey = await window.crypto.subtle.importKey(
        'raw',
        keyData as unknown as ArrayBuffer,
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltData,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        baseKey,
        { name: algorithm, length: KEY_LENGTH * 8 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Dual-Mode Decryption (GCM + Legacy CBC)
 */
export const decrypt = async (text: string): Promise<string> => {
    if (!text || !text.startsWith(ENCRYPTED_PREFIX)) return text;

    const data = text.slice(ENCRYPTED_PREFIX.length);

    try {
        // Mode A: AES-256-GCM
        if (data.startsWith(GCM_PREFIX)) {
            const key = await deriveKey(ALGORITHM_GCM);
            const parts = data.slice(GCM_PREFIX.length).split(':');
            if (parts.length < 3) throw new Error('Malformed GCM envelope');

            const iv = new Uint8Array(parts[0].match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));

            // Extract tag and ciphertext
            const tagHex = parts[1];
            const ciphertextHex = parts[2];
            const combinedHex = ciphertextHex + tagHex;

            const encryptedData = new Uint8Array(combinedHex.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));

            const buffer = await window.crypto.subtle.decrypt({ name: ALGORITHM_GCM, iv }, key, encryptedData);
            return new TextDecoder().decode(buffer);
        }

        // Mode B: Legacy AES-256-CBC
        const key = await deriveKey(ALGORITHM_CBC);
        const parts = data.split(':');
        if (parts.length < 2) return text;

        const iv = new Uint8Array(parts[0].match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));
        const encryptedData = new Uint8Array(parts[1].match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));

        const buffer = await window.crypto.subtle.decrypt({ name: ALGORITHM_CBC, iv }, key, encryptedData);
        return new TextDecoder().decode(buffer);

    } catch (error) {
        console.error('[Security] Decryption failed:', error);
        return `[DECRYPTION_FAILED: Authentication failure or key mismatch]`;
    }
};

/**
 * AES-256-GCM Encryption (Production-Grade E2EE)
 */
export const encrypt = async (text: string): Promise<string> => {
    if (!text || !ENCRYPTION_KEY) return text;

    try {
        const key = await deriveKey(ALGORITHM_GCM);
        const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH_GCM));
        const encodedText = new TextEncoder().encode(text);

        const encryptedBuffer = await window.crypto.subtle.encrypt({ name: ALGORITHM_GCM, iv }, key, encodedText);

        const encryptedArray = new Uint8Array(encryptedBuffer);
        const hex = Array.from(encryptedArray).map(b => b.toString(16).padStart(2, '0')).join('');

        const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');

        // Extract 16-byte tag (last 32 hex chars) from Web Crypto output
        const tagHex = hex.slice(-32);
        const ciphertextHex = hex.slice(0, -32);

        // Format: enc:gcm:<iv>:<tag>:<ciphertext>
        return `${ENCRYPTED_PREFIX}${GCM_PREFIX}${ivHex}:${tagHex}:${ciphertextHex}`;
    } catch (error) {
        console.error('[Security] Encryption failed:', error);
        return text;
    }
};
