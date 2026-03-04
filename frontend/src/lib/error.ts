/**
 * Canonical error message extractor.
 * Safely narrows an `unknown` catch block value to a human-readable string.
 * Handles: AxiosError shapes, native Error instances, plain strings, and fallback.
 */
export function getErrorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
        // Axios error shape: err.response.data.message
        const errObj = err as Record<string, unknown>;
        const response = errObj['response'];
        if (response && typeof response === 'object') {
            const data = (response as Record<string, unknown>)['data'];
            if (data && typeof data === 'object') {
                const msg = (data as Record<string, unknown>)['message'];
                if (typeof msg === 'string' && msg) return msg;
            }
        }
        // Native Error
        if ('message' in errObj && typeof errObj['message'] === 'string') {
            return errObj['message'] || fallback;
        }
    }
    return fallback;
}
