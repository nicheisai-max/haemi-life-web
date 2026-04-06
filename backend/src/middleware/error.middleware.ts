import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

interface HttpError extends Error {
    statusCode?: number;
    status?: number;
    code?: string | number;
}

export const errorHandler = (err: HttpError, req: Request, res: Response, _next: NextFunction) => {
    // Always log the full error internally for observability
    logger.error(`[Error] ${req.method} ${req.url}:`, {
        error: err.message,
        stack: err.stack,
        body: req.body,
        requestId: req.headers['x-request-id']
    });

    let statusCode = err.statusCode || err.status || 500;

    // Handle Multer specific errors
    if (err.name === 'MulterError' || err.message === 'Unsupported file type') {
        statusCode = 400;
        if (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') {
            err.message = 'File too large. Maximum size allowed is 10MB.';
        }
    }

    if (IS_PRODUCTION) {
        // Institutional Hardening: Never leak internal error details in production
        const safeMessage = statusCode < 500
            ? err.message || 'Request failed'
            : 'An unexpected error occurred. Please try again.';

        return sendError(res, statusCode, safeMessage);
    }

    // Development: full details for debugging
    return sendError(res, statusCode, err.message || 'Internal Server Error', err.stack);
};
