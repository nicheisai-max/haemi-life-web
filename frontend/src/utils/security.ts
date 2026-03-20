const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
    console.error('[Security] CRITICAL: VITE_ENCRYPTION_KEY is missing. Decryption will fail. Please restart the frontend dev server.');
}

const ALGORITHM_GCM = 'AES-GCM';
const ALGORITHM_CBC = 'AES-CBC';
const IV_LENGTH_GCM = 12; // WebCrypto GCM Standard
const ENCRYPTED_PREFIX = 'enc:';
const GCM_PREFIX = 'gcm:';
const SALT = 'haemi_salt';

/**
 * Derives a cryptographic key from the password using PBKDF2.
 */
async function deriveKey(algorithm: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();

    // CRITICAL: Handle the hex key from .env correctly.
    let keyData: Uint8Array;
    const rawKey = ENCRYPTION_KEY;
    if (!rawKey) {
        throw new Error('🔥 SECURITY ARCHITECTURE BLOCK: VITE_ENCRYPTION_KEY is mandatory for secure operations.');
    }

    if (/^[0-9a-fA-F]+$/.test(rawKey)) {
        const matches = rawKey.match(/.{1,2}/g);
        keyData = new Uint8Array(matches!.map((byte: string) => parseInt(byte, 16)));
    } else {
        keyData = encoder.encode(rawKey);
    }

    const saltData = encoder.encode(SALT);

    const buffer = keyData.buffer;
    if (!(buffer instanceof ArrayBuffer)) {
        throw new Error('🔥 SECURITY ARCHITECTURE BLOCK: Buffer source is not an ArrayBuffer.');
    }

    // Filter out potential non-ArrayBuffer errors
    const baseKey = await window.crypto.subtle.importKey(
        'raw',
        buffer,
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltData,
            iterations: 100000,
            hash: 'SHA-256'
        },
        baseKey,
        { name: algorithm, length: 256 },
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
            const iv = new Uint8Array(parts[0].match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));

            // CRITICAL: Format mismatch fix
            // Web Crypto expects: [ciphertext][tag]
            // Backend sends: [tag][ciphertext] (hex)
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

    } catch {
        // Silently return original text if decryption fails (likely legacy/corrupted data)
        return text;
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

        // Web Crypto output is [ciphertext][tag]
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
