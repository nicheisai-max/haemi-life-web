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

const keyCache = new Map<string, CryptoKey>();

/**
 * Derives a cryptographic key from the password using PBKDF2.
 * Phase 5: Cached to prevent redundant compute-heavy iterations.
 */
async function deriveKey(algorithm: string): Promise<CryptoKey> {
    if (keyCache.has(algorithm)) return keyCache.get(algorithm)!;
    
    const encoder = new TextEncoder();

    // CRITICAL: Handle the hex key from .env correctly.
    let keyData: Uint8Array;
    const rawKey = ENCRYPTION_KEY;
    if (!rawKey) {
        throw new Error('🔥 SECURITY ARCHITECTURE BLOCK: VITE_ENCRYPTION_KEY is mandatory for secure operations.');
    }

    if (/^[0-9a-fA-F]+$/.test(rawKey)) {
        keyData = hexToUint8Array(rawKey);
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

    const derivedKey = await window.crypto.subtle.deriveKey(
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

    keyCache.set(algorithm, derivedKey);
    return derivedKey;
}

/**
 * High-performance hex string to Uint8Array conversion.
 * Replaces regex-based conversion to prevent main-thread blocking during large message bursts.
 */
function hexToUint8Array(hex: string): Uint8Array {
    const len = hex.length;
    if (len % 2 !== 0) {
        throw new Error('[Security] Invalid hex string length');
    }
    const array = new Uint8Array(len / 2);
    for (let i = 0; i < len; i += 2) {
        array[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return array;
}

/**
 * High-performance Uint8Array to hex string conversion via lookup table.
 */
const HEX_LOOKUP = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
function uint8ArrayToHex(array: Uint8Array): string {
    let hex = '';
    for (let i = 0; i < array.length; i++) {
        hex += HEX_LOOKUP[array[i]];
    }
    return hex;
}

const decryptionCache = new Map<string, string>();

/**
 * Dual-Mode Decryption (GCM + Legacy CBC) with Performance Caching
 */
export const decrypt = async (text: string): Promise<string> => {
    if (!text || !text.startsWith(ENCRYPTED_PREFIX)) return text;
    
    // Phase 5: Decrypt Performance Fix (Single-pass decryption)
    const cached = decryptionCache.get(text);
    if (cached) return cached;

    const data = text.slice(ENCRYPTED_PREFIX.length);
    let result = text;

    try {
        // Mode A: AES-256-GCM
        if (data.startsWith(GCM_PREFIX)) {
            const key = await deriveKey(ALGORITHM_GCM);
            const parts = data.slice(GCM_PREFIX.length).split(':');
            if (parts.length < 3) return text;

            const iv = hexToUint8Array(parts[0]);
            const tagHex = parts[1];
            const ciphertextHex = parts[2];
            const combinedHex = ciphertextHex + tagHex;
            const encryptedData = hexToUint8Array(combinedHex);

            const buffer = await window.crypto.subtle.decrypt({ name: ALGORITHM_GCM, iv: iv as BufferSource }, key, encryptedData as BufferSource);
            result = new TextDecoder().decode(buffer);
        } else {
            // Mode B: Legacy AES-256-CBC
            const key = await deriveKey(ALGORITHM_CBC);
            const parts = data.split(':');
            if (parts.length < 2) return text;

            const iv = hexToUint8Array(parts[0]);
            const encryptedData = hexToUint8Array(parts[1]);

            const buffer = await window.crypto.subtle.decrypt({ name: ALGORITHM_CBC, iv: iv as BufferSource }, key, encryptedData as BufferSource);
            result = new TextDecoder().decode(buffer);
        }
        
        decryptionCache.set(text, result);
        return result;

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[Security] Decryption failed:', errorMessage);
        // Institutional Hardening: Return sanitized placeholder for corrupted/legacy records
        return '[Encrypted Message]';
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
        const hex = uint8ArrayToHex(encryptedArray);

        const ivHex = uint8ArrayToHex(iv);

        // Extract 16-byte tag (last 32 hex chars) from Web Crypto output
        const tagHex = hex.slice(-32);
        const ciphertextHex = hex.slice(0, -32);

        // Format: enc:gcm:<iv>:<tag>:<ciphertext>
        return `${ENCRYPTED_PREFIX}${GCM_PREFIX}${ivHex}:${tagHex}:${ciphertextHex}`;
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[Security] Encryption failed:', errorMessage);
        return text;
    }
};
