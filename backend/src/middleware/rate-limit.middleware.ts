import rateLimit from 'express-rate-limit';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ─── V5 FIX: Tiered rate limiters — demo-safe but production-hardened ────────
// Auth endpoints: 5 req/15min per IP (strict for brute force protection)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: IS_PRODUCTION ? 5 : 50,
    message: { success: false, error: 'Too many auth attempts. Please try again in 15 minutes.', statusCode: 429 },
    standardHeaders: true,
    legacyHeaders: false,
});

// General API: 200 req/15min
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: IS_PRODUCTION ? 200 : 300,
    message: { success: false, error: 'Too many requests. Please try again later.', statusCode: 429 },
    standardHeaders: true,
    legacyHeaders: false,
});

// AI Endpoint Limiter: 20 req/minute (prevent abuse of Gemini API cost)
export const aiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20,
    message: { success: false, error: 'AI request limit exceeded. Please wait a moment.', statusCode: 429 },
    standardHeaders: true,
    legacyHeaders: false,
});
