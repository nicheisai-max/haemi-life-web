/**
 * Centralized Enterprise Logger
 * Only logs to console when in development mode.
 */

const IS_DEV = import.meta.env.DEV;

export const logger = {
    info: (message: string, ...args: unknown[]) => {
        if (IS_DEV) console.log(`[INFO] ${message}`, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
        if (IS_DEV) console.warn(`[WARN] ${message}`, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
        if (IS_DEV) console.error(`[ERROR] ${message}`, ...args);
    },
    debug: (message: string, ...args: unknown[]) => {
        if (IS_DEV) console.debug(`[DEBUG] ${message}`, ...args);
    }
};
