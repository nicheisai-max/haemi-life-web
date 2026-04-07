import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { auditService, SYSTEM_ANONYMOUS_ID } from '../services/audit.service';
import { JWTPayload as GlobalJWTPayload } from '../types/express';
import { logger } from '../utils/logger';
import { sendError } from '../utils/response';
import { getSessionTimeoutMinutes } from '../utils/config.util';
import { UserRole, UserStatus } from '../types/db.types';

/**
 * PHASE 7.3.2 — ZERO DRIFT TYPES
 */
type JwtPayloadStrict = {
    id: string;
    sessionId: string;
    tokenVersion: number;
    email: string;
    role: 'patient' | 'doctor' | 'pharmacist' | 'admin';
    jti: string;
    exp?: number;
    iat?: number;
};

/**
 * Local Bridge Interface
 * PHASE 7.3.2 — ZERO DRIFT: Standardizing on 'id' to match JWT and DB entities.
 */
interface LocalJWTPayload extends GlobalJWTPayload {
    id: string; // Unified with JWT 'id'
}

/**
 * Local Request Interface for Middleware
 * This allows direct assignment to req.user without casting.
 */
interface AuthenticatedRequest extends Request {
    user?: LocalJWTPayload;
}

interface AuthUserRow {
    name: string;
    initials: string;
    profile_image: string | null;
    profile_image_mime: string | null;
    status: UserStatus;
    role: UserRole;
    token_version: number;
    lastActivity: Date;
    minutes_since_activity: number | null;
}


/**
 * FIX 2 — TYPE GUARD
 */
function isLocalJWTPayload(user: unknown): user is LocalJWTPayload {
    return (
        typeof user === 'object' &&
        user !== null &&
        'id' in user &&
        'role' in user &&
        'email' in user
    );
}

/**
 * Runtime Validation Helper for JWT Payload
 */
const validateJwtPayload = (decoded: unknown): decoded is JwtPayloadStrict => {
    return (
        typeof decoded === 'object' &&
        decoded !== null &&
        'id' in decoded &&
        'sessionId' in decoded &&
        'tokenVersion' in decoded &&
        'email' in decoded &&
        'role' in decoded &&
        'jti' in decoded
    );
};

/**
 * Standard Authentication Middleware
 */
export const authenticateToken = async (inputReq: Request, res: Response, next: NextFunction) => {
    const req = inputReq as AuthenticatedRequest; // Single safe transition to local type
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return sendError(res, 401, 'Authentication required');

    jwt.verify(token, process.env.JWT_SECRET as string, async (err: jwt.VerifyErrors | null, decoded: unknown) => {
        if (err || !validateJwtPayload(decoded)) {
            return sendError(res, 401, 'Invalid or expired session.');
        }

        const payload: JwtPayloadStrict = decoded;

        try {
            const userResult = await pool.query<AuthUserRow>(
                'SELECT name, initials, profile_image, profile_image_mime, status, role, token_version, "lastActivity" FROM users WHERE id = $1',
                [payload.id]
            );

            if (userResult.rows.length === 0) return sendError(res, 401, 'User session invalid.');

            const userData = userResult.rows[0];
            if (payload.tokenVersion !== userData.token_version) return sendError(res, 401, 'Session revoked.');
            if (userData.status !== 'ACTIVE') return sendError(res, 403, 'Account restricted.');

            const sessionResult = await pool.query<{ revoked: boolean, access_token_jti: string, previous_access_token_jti: string, jti_rotated_at: Date, lastActivity: Date }>(
                'SELECT revoked, access_token_jti, previous_access_token_jti, jti_rotated_at, "lastActivity" FROM user_sessions WHERE session_id = $1',
                [payload.sessionId]
            );

            if (sessionResult.rows.length === 0 || sessionResult.rows[0].revoked) return sendError(res, 401, 'Session invalid.');

            const sessionData = sessionResult.rows[0];
            const nowMs = Date.now();
            const lastActivityTime = sessionData.lastActivity ? new Date(sessionData.lastActivity).getTime() : 0;

            if (nowMs - lastActivityTime > 60000) {
                const timeoutMinutes = await getSessionTimeoutMinutes();
                const newExpiresAt = new Date(nowMs + timeoutMinutes * 60 * 1000);
                await pool.query('UPDATE user_sessions SET "lastActivity" = CURRENT_TIMESTAMP, expires_at = $1 WHERE session_id = $2', [newExpiresAt, payload.sessionId]);
                await pool.query('UPDATE users SET "lastActivity" = CURRENT_TIMESTAMP WHERE id = $1', [payload.id]);
            }

            userData.lastActivity = new Date(); // Update local ref after DB update

            /**
             * FIX 1 — STRUCTURAL TYPING
             * No cast required for finalUserPayload assignment.
             */
            const finalUserPayload: LocalJWTPayload = {
                id: payload.id,
                email: payload.email,
                role: payload.role,
                name: userData.name,
                initials: userData.initials,
                tokenVersion: payload.tokenVersion,
                jti: payload.jti,
                sessionId: payload.sessionId,
                status: userData.status,
                profileImage: userData.profile_image,
                profileImageMime: userData.profile_image_mime
            };

            req.user = finalUserPayload;
            return next();
        } catch (error: unknown) {
            logger.error('[Auth.Middleware.authenticateToken] Failure', { 
                userId: payload.id,
                error: error instanceof Error ? error.message : String(error)
            });
            return sendError(res, 500, 'Server error');
        }
    });
};

export const protect = authenticateToken;

export const relaxedAuthenticateToken = (inputReq: Request, res: Response, next: NextFunction) => {
    const req = inputReq as AuthenticatedRequest;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return next();

    jwt.verify(token, process.env.JWT_SECRET as string, async (err: jwt.VerifyErrors | null, decoded: unknown) => {
        if (err || !validateJwtPayload(decoded)) return next();

        const payload: JwtPayloadStrict = decoded;

        try {
            const userResult = await pool.query<AuthUserRow>('SELECT status, role, token_version FROM users WHERE id = $1', [payload.id]);
            if (userResult.rows.length === 0) return next();

            const userData = userResult.rows[0];
            if (payload.tokenVersion !== userData.token_version || userData.status !== 'ACTIVE') return next();

            const finalUserPayload: LocalJWTPayload = {
                id: payload.id,
                email: payload.email,
                role: payload.role,
                name: '',
                tokenVersion: payload.tokenVersion,
                jti: payload.jti,
                sessionId: payload.sessionId,
                status: userData.status
            };

            req.user = finalUserPayload;
            return next();
        } catch (error: unknown) {
            logger.error('[Auth.Middleware.relaxedAuthenticateToken] Graceful skip on error', {
                error: error instanceof Error ? error.message : String(error)
            });
            return next();
        }
    });
};

export const requireRole = (allowedRole: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;
        if (!isLocalJWTPayload(user) || user.role !== allowedRole) {
            await auditService.log({
                userId: isLocalJWTPayload(user) ? user.id : SYSTEM_ANONYMOUS_ID,
                actorRole: isLocalJWTPayload(user) ? user.role : undefined,
                action: 'ACCESS_DENIED_RBAC',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            return sendError(res, 403, 'Access denied.');
        }
        next();
    };
};

export const authorizeRole = (roles: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;
        if (!isLocalJWTPayload(user) || !roles.includes(user.role)) {
            await auditService.log({
                userId: isLocalJWTPayload(user) ? user.id : SYSTEM_ANONYMOUS_ID,
                actorRole: isLocalJWTPayload(user) ? user.role : undefined,
                action: 'ACCESS_DENIED_RBAC_MULTI',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            return sendError(res, 403, 'Access denied.');
        }
        next();
    };
};

export function restrictTo(...roles: string[]) {
    return authorizeRole(roles);
}
