import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR);
}

const getTimestamp = () => new Date().toISOString();

// Basic PHI Masking
function maskPHI(obj: any): any {
    if (typeof obj === 'string') {
        // Mask emails
        obj = obj.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi, '***@***.***');
        // Mask potential phone numbers (simple heuristics)
        obj = obj.replace(/(\d{3})\d{3}(\d{4})/g, '$1***$2');
        return obj;
    }
    if (typeof obj === 'object' && obj !== null) {
        const newObj: any = Array.isArray(obj) ? [] : {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                // Sensitive keys to always mask fully
                if (/password|token|secret|credit_?card/i.test(key)) {
                    newObj[key] = '[REDACTED]';
                } else {
                    newObj[key] = maskPHI(obj[key]);
                }
            }
        }
        return newObj;
    }
    return obj;
}

export const logger = {
    info: (message: string, meta?: any) => {
        const maskedMeta = meta ? maskPHI(meta) : undefined;
        const log = { timestamp: getTimestamp(), level: 'INFO', message, meta: maskedMeta };
        console.log(`[INFO] ${message}`, maskedMeta || '');
        appendToFile(log);
    },
    warn: (message: string, meta?: any) => {
        const maskedMeta = meta ? maskPHI(meta) : undefined;
        const log = { timestamp: getTimestamp(), level: 'WARN', message, meta: maskedMeta };
        console.warn(`[WARN] ${message}`, maskedMeta || '');
        appendToFile(log);
    },
    error: (message: string, meta?: any) => {
        const maskedMeta = meta ? maskPHI(meta) : undefined;
        const log = { timestamp: getTimestamp(), level: 'ERROR', message, meta: maskedMeta };
        console.error(`[ERROR] ${message}`, maskedMeta || '');
        appendToFile(log);
    },
    auth: (message: string, meta?: any) => {
        const maskedMeta = meta ? maskPHI(meta) : undefined;
        const log = { timestamp: getTimestamp(), level: 'AUTH', message, meta: maskedMeta };
        console.log(`[AUTH] ${message}`, maskedMeta || '');
        appendToFile(log, 'auth.log');
    }
};

function appendToFile(log: any, filename: string = 'app.log') {
    try {
        const logLine = JSON.stringify(log) + '\n';
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR);
        }
        fs.appendFileSync(path.join(LOG_DIR, filename), logLine);
    } catch (err) {
        console.error('Failed to write to log file', err);
    }
}
