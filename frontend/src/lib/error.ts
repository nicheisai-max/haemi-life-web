export interface ApiErrorResponse {
    success: boolean;
    code: string;
    message: string;
    details?: unknown;
    statusCode: number;
}

/**
 * Canonical error message extractor.
 * Safely narrows an `unknown` catch block value to a human-readable string.
 * Handles: AxiosError shapes, native Error instances, plain strings, and fallback.
 */
export function getErrorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
    if (typeof err === 'string') return err;

    if (err && typeof err === 'object') {
        const errObj = err as Record<string, unknown>;

        // 1. Unified Backend Response Structure (err.response.data.message)
        const response = errObj['response'] as Record<string, unknown> | undefined;
        if (response && typeof response === 'object') {
            const data = response['data'] as ApiErrorResponse | undefined;
            if (data && typeof data === 'object') {
                if (typeof data.message === 'string' && data.message) return data.message;
            }
        }

        // 2. Direct ApiErrorResponse Shape (Pre-normalized by interceptor)
        if (typeof errObj.message === 'string' && errObj.message) {
            return errObj.message;
        }

        // 3. Native Error
        if ('message' in errObj && typeof errObj['message'] === 'string') {
            return errObj['message'] || fallback;
        }

    }

    return fallback;
}

