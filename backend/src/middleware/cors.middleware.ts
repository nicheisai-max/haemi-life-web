import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Global CORS & Security Headers Middleware (Zero-Trust)
 * Central authority for all cross-origin and security header policies.
 */
export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Socket.IO has its own CORS handling. Manually setting headers here can cause 
    // "Multiple Access-Control-Allow-Origin" errors leading to 400 Bad Request.
    if (req.path.startsWith('/socket.io/')) {
        return next();
    }

    const origin = req.header('Origin');
    const isAllowed = !origin || (env.allowedOrigins && env.allowedOrigins.includes(origin));

    // 1. CORS Headers
    if (origin && isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        const fallbackOrigin = env.allowedOrigins && env.allowedOrigins.length > 0 ? env.allowedOrigins[0] : 'http://localhost:5173';
        res.setHeader('Access-Control-Allow-Origin', fallbackOrigin);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Range, Cache-Control, Pragma, Expires, Accept, Origin, x-client-domain');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Content-Disposition, Content-Range, X-Content-Type-Options');

    // 2. Security Headers (Enterprise Hardening)
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // 3. Handle Preflight
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
};
