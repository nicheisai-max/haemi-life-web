import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR);
}

const getTimestamp = () => new Date().toISOString();

// Basic PHI Masking
function maskPHI(obj: unknown): unknown {
    if (typeof obj === 'string') {
        // Mask emails
        let masked = obj.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi, '***@***.***');
        // Mask potential phone numbers (simple heuristics)
        masked = masked.replace(/(\d{3})\d{3}(\d{4})/g, '$1***$2');
        return masked;
    }
    if (typeof obj === 'object' && obj !== null) {
        const isArr = Array.isArray(obj);
        const newObj = (isArr ? [] : {}) as Record<string, unknown>;
        const inputObj = obj as Record<string, unknown>;

        for (const key in inputObj) {
            if (Object.prototype.hasOwnProperty.call(inputObj, key)) {
                // Sensitive keys to always mask fully
                if (/password|token|secret|credit_?card/i.test(key)) {
                    newObj[key] = '[REDACTED]';
                } else {
                    newObj[key] = maskPHI(inputObj[key]);
                }
            }
        }
        return isArr ? Object.values(newObj) : newObj;
    }
    return obj;
}

export const logger = {
    info: (message: string, meta?: unknown) => {
        const maskedMeta = meta ? maskPHI(meta) : undefined;
        const log = { timestamp: getTimestamp(), level: 'INFO', message, meta: maskedMeta };
        // console.log(`[INFO] ${message}`, maskedMeta || '');
        appendToFile(log);
    },
    debug: (message: string, meta?: unknown) => {
        const maskedMeta = meta ? maskPHI(meta) : undefined;
        const log = { timestamp: getTimestamp(), level: 'DEBUG', message, meta: maskedMeta };
        appendToFile(log);
    },
    warn: (message: string, meta?: unknown) => {
        const maskedMeta = meta ? maskPHI(meta) : undefined;
        const log = { timestamp: getTimestamp(), level: 'WARN', message, meta: maskedMeta };
        appendToFile(log);
    },
    error: (message: string, meta?: unknown) => {
        const maskedMeta = meta ? maskPHI(meta) : undefined;
        const log = { timestamp: getTimestamp(), level: 'ERROR', message, meta: maskedMeta };
        appendToFile(log);
    },
    auth: (message: string, meta?: unknown) => {
        const maskedMeta = meta ? maskPHI(meta) : undefined;
        const log = { timestamp: getTimestamp(), level: 'AUTH', message, meta: maskedMeta };
        // console.log(`[AUTH] ${message}`, maskedMeta || '');
        appendToFile(log, 'auth.log');
    }
};

function appendToFile(log: unknown, filename: string = 'app.log') {
    try {
        const logLine = JSON.stringify(log) + '\n';
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR);
        }
        fs.appendFileSync(path.join(LOG_DIR, filename), logLine);
    } catch {
        // Institutional Hardening: Silent failure for the logger to prevent crash-loops
    }

}
