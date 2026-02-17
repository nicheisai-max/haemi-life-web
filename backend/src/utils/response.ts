import { Response } from 'express';

/**
 * Standardized API Response Wrapper
 */
export const sendResponse = (
    res: Response,
    statusCode: number,
    success: boolean,
    message: string,
    data: any = null
) => {
    res.status(statusCode).json({
        success,
        message,
        data,
        statusCode
    });
};

export const sendError = (
    res: Response,
    statusCode: number,
    message: string,
    error: any = null
) => {
    res.status(statusCode).json({
        success: false,
        error: message,
        details: process.env.NODE_ENV === 'development' ? error : undefined,
        statusCode
    });
};
