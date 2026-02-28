import { Request, Response, NextFunction } from 'express';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

import { logger } from '../utils/logger';

/**
 * V7 FIX: Global error handler.
 * - In production: returns a generic message — never exposes err.message or stack traces.
 * - In development: returns full error details for debugging.
 * This prevents information disclosure attacks where attackers probe error messages
 * to learn about the system's internals (DB schema, file paths, library versions).
 */
interface HttpError extends Error {
    statusCode?: number;
    status?: number;
    code?: string | number;
}

export const errorHandler = (err: HttpError, req: Request, res: Response, _next: NextFunction) => {
    // Always log the full error internally for observability using secure logger
    logger.error(`[Error] ${req.method} ${req.url}:`, { error: err.message, stack: err.stack, body: req.body });

    let statusCode = err.statusCode || err.status || 500;

    // Handle Multer specific errors
    if (err.name === 'MulterError') {
        statusCode = 400;
        if (err.code === 'LIMIT_FILE_SIZE') {
            err.message = 'File too large. Maximum size allowed is 10MB.';
        }
    }

    if (IS_PRODUCTION) {
        // Never leak internal error details in production
        const safeMessage = statusCode < 500
            ? err.message || 'Request failed'  // 4xx: safe to show client errors
            : 'An unexpected error occurred. Please try again.'; // 5xx: always generic

        return res.status(statusCode).json({
            success: false,
            error: safeMessage,
            statusCode,
        });
    }

    // Development: full details for debugging
    return res.status(statusCode).json({
        success: false,
        error: err.message || 'Internal Server Error',
        statusCode,
        stack: err.stack,
    });
};
