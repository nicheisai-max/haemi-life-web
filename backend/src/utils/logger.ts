import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR);
}

const getTimestamp = () => new Date().toISOString();

export const logger = {
    info: (message: string, meta?: any) => {
        const log = { timestamp: getTimestamp(), level: 'INFO', message, ...meta };
        console.log(`[INFO] ${message}`, meta || '');
        appendToFile(log);
    },
    warn: (message: string, meta?: any) => {
        const log = { timestamp: getTimestamp(), level: 'WARN', message, ...meta };
        console.warn(`[WARN] ${message}`, meta || '');
        appendToFile(log);
    },
    error: (message: string, meta?: any) => {
        const log = { timestamp: getTimestamp(), level: 'ERROR', message, ...meta };
        console.error(`[ERROR] ${message}`, meta || '');
        appendToFile(log);
    },
    auth: (message: string, meta?: any) => {
        const log = { timestamp: getTimestamp(), level: 'AUTH', message, ...meta };
        console.log(`[AUTH] ${message}`, meta || '');
        appendToFile(log, 'auth.log');
    }
};

function appendToFile(log: any, filename: string = 'app.log') {
    try {
        const logLine = JSON.stringify(log) + '\n';
        fs.appendFileSync(path.join(LOG_DIR, filename), logLine);
    } catch (err) {
        console.error('Failed to write to log file', err);
    }
}
