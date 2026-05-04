import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { userRepository } from '../repositories/user.repository';
import { logger } from '../utils/logger';
import { auditService, SYSTEM_ANONYMOUS_ID } from '../services/audit.service';
import { emitToAdmins } from '../services/admin-broadcast.service';
import { getSessionTimeoutMinutes, getJwtAccessExpiry, getJwtRefreshExpiry } from '../utils/config.util';
import { parseUA } from '../utils/ua-parser.util';
import { sendResponse, sendError } from '../utils/response';
import crypto from 'crypto';
import { isRefreshJWTPayload } from '../utils/type-guards';
import { observabilityService } from '../services/observability.service';
import { UserRoleSchema } from '../../../shared/schemas/observability.schema';
import { mapUserToResponse } from '../utils/user.mapper';
import { UserEntity, UserSessionEntity } from '../types/db.types';
import { JWTPayload } from '../types/express';
import { statusService } from '../services/status.service';

/**
 * Row shape returned by the `user_sessions` INSERT ... RETURNING used by
 * the signup and login flows. The shape mirrors the columns we surface
 * to admins via the `session:created` event so the broadcast payload is
 * built from the canonical post-INSERT state — id, created_at, and
 * last_activity (initially NULL on insert) come from the DB rather than
 * being guessed locally. Captured here so the type is shared between
 * the two call sites without `any`.
 */
interface InsertedSessionRow {
    id: string;
    user_id: string;
    user_role: string;
    session_id: string;
    ip_address: string | null;
    user_agent: string | null;
    browser_name: string | null;
    os_name: string | null;
    device_type: string | null;
    created_at: Date;
    last_activity: Date | null;
}

interface SignupRequest {
    email: string;
    password: string;
    role: 'patient' | 'doctor' | 'pharmacist' | 'admin';
    name: string;
    phoneNumber: string;
    idNumber?: string;
}

interface LoginRequest {
    identifier: string;
    password: string;
}

interface UpdateProfileRequest {
    name: string;
    email: string;
    phoneNumber: string;
}

interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

interface RefreshTokenRequest {
    refreshToken: string;
}


const getJwtSecret = (): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      logger.error('CRITICAL: JWT_SECRET is not configured in environment variables');
      return 'HAEMI_LIFE_INTEGRITY_FAILSAFE';
    }
    return secret;
};

const getUA = (req: Request): string => {
    const ua = req.headers['user-agent'];
    return typeof ua === 'string' ? ua : '';
};

// Phase 7: Backend Refresh Rate Limiting (In-Memory Sliding Window)
const refreshRateLimitMap = new Map<string, { counts: number[]; lastCleanup: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REFRESH_ATTEMPTS = 5;

const checkRefreshRateLimit = (sessionId: string): boolean => {
    const now = Date.now();
    const sessionData = refreshRateLimitMap.get(sessionId) || { counts: [], lastCleanup: now };
    
    // Cleanup old timestamps
    sessionData.counts = sessionData.counts.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
    
    if (sessionData.counts.length >= MAX_REFRESH_ATTEMPTS) {
        return false;
    }
    
    sessionData.counts.push(now);
    refreshRateLimitMap.set(sessionId, sessionData);
    
    // Periodic global cleanup (every 100 calls) to prevent memory leaks
    if (Math.random() < 0.01) {
        for (const [sid, data] of refreshRateLimitMap.entries()) {
            const filtered = data.counts.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
            if (filtered.length === 0) refreshRateLimitMap.delete(sid);
            else refreshRateLimitMap.set(sid, { counts: filtered, lastCleanup: now });
        }
    }
    
    return true;
};

export const signup = async (req: Request, res: Response) => {
    const { email, password, role, name, phoneNumber, idNumber } = req.body as SignupRequest;


    // Institutional Hardening: Input Validation
    if (!email || !password || !role || !name || !phoneNumber) {
        return sendError(res, 400, 'Missing required fields (name, email, phoneNumber, password, role)', 'MISSING_FIELDS');
    }

    try {
        // Check if user exists (by phone or email if provided)
        const userCheck = await userRepository.findByPhoneOrEmail(phoneNumber, email);
        if (userCheck) {
            return sendError(res, 400, 'User already exists with this phone number or email', 'USER_EXISTS');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const newUser = await userRepository.create({
                name,
                phoneNumber,
                email,
                password: hashedPassword,
                role,
                idNumber: idNumber || null
            }, client);

            await client.query('COMMIT');

            // PHASE 1: Persistent Session record
            const sessionId = crypto.randomUUID();
            const accessJti = crypto.randomBytes(16).toString('hex');
            const refreshJti = crypto.randomBytes(16).toString('hex');

            const userAgent = getUA(req);
            const { browser, os, device } = parseUA(userAgent);

            const sessionInsert = await pool.query<InsertedSessionRow>(
                `INSERT INTO user_sessions (user_id, user_role, session_id, access_token_jti, refresh_token_jti, ip_address, user_agent, browser_name, os_name, device_type)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 RETURNING id, user_id, user_role, session_id, ip_address, user_agent, browser_name, os_name, device_type, created_at, last_activity`,
                [newUser.id, newUser.role, sessionId, accessJti, refreshJti, req.ip || null, userAgent, browser, os, device]
            );

            // Best-effort admin observability broadcast — the new session
            // appears live on the admin Sessions page without a refresh.
            // Emit failures are logged inside `emitToAdmins` and never
            // propagate; the user's signup is unaffected.
            const insertedSessionRow: InsertedSessionRow | undefined = sessionInsert.rows[0];
            if (insertedSessionRow !== undefined) {
                emitToAdmins({
                    event: 'session:created',
                    payload: {
                        id: insertedSessionRow.id,
                        sessionId: insertedSessionRow.session_id,
                        userId: insertedSessionRow.user_id,
                        userRole: insertedSessionRow.user_role,
                        userName: newUser.name ?? null,
                        userEmail: newUser.email ?? null,
                        profileImage: null,
                        ipAddress: insertedSessionRow.ip_address,
                        userAgent: insertedSessionRow.user_agent,
                        browserName: insertedSessionRow.browser_name,
                        osName: insertedSessionRow.os_name,
                        deviceType: insertedSessionRow.device_type,
                        createdAt: insertedSessionRow.created_at.toISOString(),
                        lastActivity: insertedSessionRow.last_activity !== null
                            ? insertedSessionRow.last_activity.toISOString()
                            : null,
                    },
                });
            }

            // Generate Access Token (15m)
            const accessToken = jwt.sign(
                {
                    id: newUser.id,
                    email: newUser.email,
                    role: newUser.role,
                    tokenVersion: newUser.token_version,
                    jti: accessJti,
                    sessionId: sessionId
                },
                getJwtSecret(),
                { expiresIn: await getJwtAccessExpiry() }
            );

            // Generate Refresh Token (7d)
            const refreshToken = jwt.sign(
                {
                    id: newUser.id,
                    tokenVersion: newUser.token_version,
                    jti: refreshJti,
                    sessionId: sessionId
                },
                getJwtSecret(),
                { expiresIn: await getJwtRefreshExpiry() }
            );

            // Audit
            await auditService.log({
                userId: newUser.id,
                action: 'SIGNUP_SUCCESS',
                ipAddress: req.ip,
                userAgent: userAgent,
                sessionId: sessionId,
                accessTokenJti: accessJti,
                refreshTokenJti: refreshJti
            });

            observabilityService.logSessionStart({
                session: {
                    sessionId: sessionId,
                    userId: newUser.id,
                    role: UserRoleSchema.parse(newUser.role),
                    loginTime: new Date().toISOString(),
                    last_activity: new Date().toISOString(),
                    status: 'active',
                    ipAddress: req.ip,
                    userAgent: userAgent
                },
                timestamp: new Date().toISOString(),
                source: 'backend'
            });

            await pool.query('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1', [newUser.id]);

            return sendResponse(res, 201, true, 'User created successfully', {
                token: accessToken,
                refreshToken: refreshToken,
                user: mapUserToResponse(newUser)
            });
        } catch (error: unknown) {
            await client.query('ROLLBACK');
            logger.error('[Auth.Signup] Transaction failed', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                email
            });
            throw error;
        } finally {
            client.release();
        }
    } catch (error: unknown) {
        logger.error('[Auth.Signup] General failure', { 
            error: error instanceof Error ? error.message : String(error), 
            email, 
            phoneNumber, 
            role 
        });
        return sendError(res, 500, 'Error creating user');
    }
};

export const login = async (req: Request, res: Response) => {
    const { identifier, password } = req.body as LoginRequest;


    try {
        // Unified query: Check if identifier matches email OR phone_number
        const user = await userRepository.findByEmailOrPhone(identifier);

        if (!user) {
            // Audit failed attempt (unknown user)
            await auditService.log({
                userId: SYSTEM_ANONYMOUS_ID,
                action: 'LOGIN_FAILED',
                metadata: { reason: 'User not found', identifier },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });

            observabilityService.logLogin({
                success: false,
                identifier,
                reason: 'User not found',
                timestamp: new Date().toISOString(),
                ipAddress: req.ip,
                userAgent: getUA(req),
                source: 'backend'
            });

            return sendError(res, 400, 'Invalid credentials', 'INVALID_CREDENTIALS');
        }

        // STRICT STATUS CHECK
        if (user.status !== 'ACTIVE') {
            await auditService.log({
                userId: user.id,
                actorRole: user.role,
                action: 'LOGIN_DENIED',
                metadata: { reason: `User status is ${user.status}` },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });

            observabilityService.logLogin({
                success: false,
                userId: user.id,
                role: UserRoleSchema.parse(user.role),
                identifier,
                reason: `Account status: ${user.status}`,
                timestamp: new Date().toISOString(),
                ipAddress: req.ip,
                userAgent: getUA(req),
                source: 'backend'
            });

            return sendError(res, 403, 'Account is not active. Please contact support.');
        }

        // PASSWORD GUARD: `user.password` is optional on the entity (the
        // column is hidden from generic SELECTs). At login we explicitly
        // SELECT it, so it must be present — but assert with a typed
        // narrow rather than a non-null assertion.
        if (typeof user.password !== 'string' || user.password.length === 0) {
            logger.error('[Auth] Login row missing password hash for active user', { userId: user.id });
            return sendError(res, 500, 'Account verification unavailable');
        }
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            await auditService.log({
                userId: user.id,
                actorRole: user.role,
                action: 'LOGIN_FAILED',
                metadata: { reason: 'Invalid password' },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });

            observabilityService.logLogin({
                success: false,
                userId: user.id,
                role: UserRoleSchema.parse(user.role),
                identifier,
                reason: 'Invalid password',
                timestamp: new Date().toISOString(),
                ipAddress: req.ip,
                userAgent: getUA(req),
                source: 'backend'
            });

            logger.auth('Failed login attempt: Invalid password', { identifier, ip: req.ip });
            return sendError(res, 400, 'Invalid credentials', 'INVALID_CREDENTIALS');
        }

        // Update last_activity directly so the middleware doesn't instantly invalidate the new session
        await pool.query('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        // Generate Session Identity
        const sessionId = crypto.randomUUID();
        const accessJti = crypto.randomBytes(16).toString('hex');
        const refreshJti = crypto.randomBytes(16).toString('hex');

        const userAgent = getUA(req);
        const { browser, os, device } = parseUA(userAgent);

        // Persistent Session record
        const sessionInsert = await pool.query<InsertedSessionRow>(
            `INSERT INTO user_sessions (user_id, user_role, session_id, access_token_jti, refresh_token_jti, ip_address, user_agent, browser_name, os_name, device_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id, user_id, user_role, session_id, ip_address, user_agent, browser_name, os_name, device_type, created_at, last_activity`,
            [user.id, user.role, sessionId, accessJti, refreshJti, req.ip, userAgent, browser, os, device]
        );

        // Best-effort admin observability broadcast — the new session
        // appears live on the admin Sessions page without a refresh.
        // Emit failures are logged inside `emitToAdmins` and never
        // propagate; the user's login is unaffected.
        const insertedSessionRow: InsertedSessionRow | undefined = sessionInsert.rows[0];
        if (insertedSessionRow !== undefined) {
            emitToAdmins({
                event: 'session:created',
                payload: {
                    id: insertedSessionRow.id,
                    sessionId: insertedSessionRow.session_id,
                    userId: insertedSessionRow.user_id,
                    userRole: insertedSessionRow.user_role,
                    userName: user.name ?? null,
                    userEmail: user.email ?? null,
                    profileImage: null,
                    ipAddress: insertedSessionRow.ip_address,
                    userAgent: insertedSessionRow.user_agent,
                    browserName: insertedSessionRow.browser_name,
                    osName: insertedSessionRow.os_name,
                    deviceType: insertedSessionRow.device_type,
                    createdAt: insertedSessionRow.created_at.toISOString(),
                    lastActivity: insertedSessionRow.last_activity !== null
                        ? insertedSessionRow.last_activity.toISOString()
                        : null,
                },
            });
        }

        // Audit Successful Login
        await auditService.log({
            userId: user.id,
            actorRole: user.role,
            action: 'LOGIN_SUCCESS',
            ipAddress: req.ip,
            userAgent: userAgent,
            sessionId: sessionId,
            accessTokenJti: accessJti,
            refreshTokenJti: refreshJti
        });

        observabilityService.logLogin({
            success: true,
            userId: user.id,
            role: UserRoleSchema.parse(user.role),
            identifier,
            timestamp: new Date().toISOString(),
            ipAddress: req.ip,
            userAgent: userAgent,
            source: 'backend'
        });

        observabilityService.logSessionStart({
            session: {
                sessionId: sessionId,
                userId: user.id,
                role: UserRoleSchema.parse(user.role),
                loginTime: new Date().toISOString(),
                last_activity: new Date().toISOString(),
                status: 'active',
                ipAddress: req.ip,
                userAgent: userAgent
            },
            timestamp: new Date().toISOString(),
            source: 'backend'
        });

        logger.auth('Successful login', { userId: user.id, email: user.email, role: user.role });


        // Generate Access Token (15m)
        const accessToken = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                tokenVersion: user.token_version,
                jti: accessJti,
                sessionId: sessionId
            },
            getJwtSecret(),
            { expiresIn: await getJwtAccessExpiry() }
        );

        // Generate Refresh Token (7d)
        const refreshToken = jwt.sign(
            {
                id: user.id,
                tokenVersion: user.token_version,
                jti: refreshJti,
                sessionId: sessionId
            },
            getJwtSecret(),
            { expiresIn: await getJwtRefreshExpiry() }
        );

        /* 
           PATCH: Removing cookie-based refresh token for multi-tab isolation.
           Now returning refreshToken in the JSON response body.
        */
        // res.cookie('refreshToken', refreshToken, {
        //     httpOnly: true,
        //     secure: process.env.NODE_ENV === 'production',
        // Update activity heartbeat on login with explicit UTC SSOT
        await pool.query('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        const timeoutMinutes = await getSessionTimeoutMinutes();

        return sendResponse(res, 200, true, 'Login successful', {
            token: accessToken,
            refreshToken: refreshToken,
            serverTime: new Date().toISOString(),
            sessionTimeout: timeoutMinutes,
            user: mapUserToResponse(user)
        });
    } catch (error: unknown) {
        logger.error('[Auth.Login] Server error', { 
            error: error instanceof Error ? error.message : String(error), 
            identifier 
        });
        return sendError(res, 500, 'Server error', 'SERVER_ERROR');
    }
};

export const getProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return sendError(res, 401, 'Unauthorized');
        const user = await userRepository.findById(userId);

        if (!user) return sendError(res, 404, 'User not found');
        return sendResponse(res, 200, true, 'Profile fetched', mapUserToResponse(user));
    } catch (error: unknown) {
        logger.error('[Auth.GetProfile] Error fetching profile', {
            error: error instanceof Error ? error.message : String(error),
            userId: req.user?.id
        });
        return sendError(res, 500, 'Server error');
    }
};

export const updateProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return sendError(res, 401, 'Unauthorized');
        const { name, email, phoneNumber } = req.body as UpdateProfileRequest;


        const updatedUser = await userRepository.updateProfile(userId, { name, email, phoneNumber });

        if (!updatedUser) {
            return sendError(res, 404, 'User not found');
        }

        return sendResponse(res, 200, true, 'Profile updated', mapUserToResponse(updatedUser));
    } catch (error: unknown) {
        logger.error('[Auth.UpdateProfile] Error updating profile', {
            error: error instanceof Error ? error.message : String(error),
            userId: req.user?.id
        });
        return sendError(res, 500, 'Server error');
    }
};

export const uploadProfileImage = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return sendError(res, 400, 'No file uploaded');
        }

        const userId = req.user?.id;
        if (!userId) return sendError(res, 401, 'Unauthorized');
        const updatedUser = await userRepository.updateProfileImage(
            userId,
            req.file.buffer,
            req.file.mimetype
        );

        if (!updatedUser) {
            return sendError(res, 404, 'User not found');
        }

        return sendResponse(res, 200, true, 'Profile image updated successfully', {
            user: mapUserToResponse(updatedUser)
        });
    } catch (error: unknown) {
        logger.error('[Auth.UploadProfileImage] Failure', { 
            userId: req.user?.id, 
            error: error instanceof Error ? error.message : String(error)
        });
        return sendError(res, 500, 'Server error during upload process');
    }
};

export const changePassword = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return sendError(res, 401, 'Unauthorized');
        const { currentPassword, newPassword } = req.body as ChangePasswordRequest;


        // Get current password hash
        const passwordHash = await userRepository.getPasswordHash(userId);
        if (!passwordHash) {
            return sendError(res, 404, 'User not found');
        }

        const validPassword = await bcrypt.compare(currentPassword, passwordHash);

        if (!validPassword) {
            return sendError(res, 400, 'Invalid current password');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await userRepository.updatePassword(userId, hashedPassword);

        return sendResponse(res, 200, true, 'Password updated successfully');
    } catch (error: unknown) {
        logger.error('[Auth.ChangePassword] Failure', {
            error: error instanceof Error ? error.message : String(error),
            userId: req.user?.id
        });
        return sendError(res, 500, 'Server error');
    }
};

export const refreshToken = async (req: Request, res: Response) => {
    const { refreshToken: refreshTokenHeader } = req.body as RefreshTokenRequest;


    if (!refreshTokenHeader) {
        return sendResponse(res, 200, false, 'No active session');
    }

    const client = await pool.connect();
    let decoded: JWTPayload | null = null;
    try {
        await client.query('BEGIN');

        // 1. Verify token signature and basic expiration
        decoded = jwt.verify(refreshTokenHeader, getJwtSecret()) as JWTPayload;
        if (!isRefreshJWTPayload(decoded)) {
            await client.query('ROLLBACK');
            return sendError(res, 401, 'Invalid session structure');
        }

        const decodedPayload = decoded as JWTPayload;
        const { id: userId, sessionId: sessionId, tokenVersion: tokenVersion } = decodedPayload;

        if (!sessionId || !userId) {
            logger.error('[Security] Refresh token missing critical fields', { userId, sessionId });
            await client.query('ROLLBACK');
            return sendResponse(res, 401, false, 'Invalid token structure');
        }

        // Phase 7: Apply Rate Limiting
        if (!checkRefreshRateLimit(sessionId)) {
            logger.warn('[Security] Refresh rate limit exceeded', { sessionId, userId });
            await client.query('ROLLBACK');
            return sendError(res, 429, 'Too many refresh attempts. Please try again in a minute.');
        }

        // 2. Fetch User and Session state.
        // P1 RACE FIX (Phase 12): both reads acquire row-level locks
        // (`FOR UPDATE`) so concurrent refresh attempts on the same
        // session serialize at the database. Without this, two parallel
        // refreshes could each observe the same `token_version` and JTI,
        // mint two new access tokens, and rotate the session out of step
        // with the underlying user row.
        const userRes = await client.query(
            'SELECT id, status, token_version, email, role, last_activity FROM users WHERE id = $1 FOR UPDATE',
            [userId]
        );
        const user = userRes.rows[0] as UserEntity | undefined;

        if (!user || user.status !== 'ACTIVE') {
            await client.query('ROLLBACK');
            return sendError(res, 401, 'Invalid session');
        }

        const sessionRes = await client.query(
            `SELECT refresh_token_jti, previous_refresh_token_jti, jti_rotated_at, last_activity,
             access_token_jti, revoked, expires_at FROM user_sessions WHERE session_id = $1 FOR UPDATE`,
            [sessionId]
        );
        const session = sessionRes.rows[0] as UserSessionEntity | undefined;


        // 3. Security Check: Token Rotation & Versioning
        const isVersionMismatch = tokenVersion !== undefined && tokenVersion !== user.token_version;
        
        // GRACE WINDOW LOGIC (Google/Meta Grade)
        const currentJti = session?.refresh_token_jti;
        const previousJti = session?.previous_refresh_token_jti;
        const rotatedAt = session?.jti_rotated_at ? new Date(session.jti_rotated_at).getTime() : 0;
        const now = Date.now();
        const GRACE_PERIOD_MS = 60 * 1000; // 60 seconds

        const isCurrentJti = decoded.jti && currentJti && decoded.jti === currentJti;
        const isGracefulJti = decoded.jti && previousJti && decoded.jti === previousJti && (now - rotatedAt) < GRACE_PERIOD_MS;

        if (isVersionMismatch || !session || session.revoked || (!isCurrentJti && !isGracefulJti)) {
            // 3b. Forensic Violation Detection (Version Mismatch or JTI Replay)
            if (session && (isVersionMismatch || (!isCurrentJti && !isGracefulJti))) {
                const isExpiredGraceJti = !isVersionMismatch && decoded.jti === previousJti;
                
                logger.warn(isVersionMismatch 
                    ? '[Security] TOKEN VERSION MISMATCH (User identity stale)'
                    : (isExpiredGraceJti 
                        ? '[Security] REPLAY ATTACK OR STALE TOKEN DETECTED (Grace window exceeded)' 
                        : '[Security] Token rotation violation detected (Unknown JTI)'), 
                {
                    userId: user.id,
                    sessionId,
                    isVersionMismatch,
                    receivedJti: decoded.jti,
                    currentJti,
                    previousJti,
                    rotatedAt: session.jti_rotated_at,
                    timeSinceRotation: now - rotatedAt
                });
                
                // On violation: Kill the entire session immediately (Enterprise Guard)
                await client.query('UPDATE user_sessions SET revoked = TRUE WHERE session_id = $1', [sessionId]);
                await client.query('COMMIT');
                // P0 FIX: Institutional Security Violation reporting
                return sendError(res, 401, 'Session revoked due to security violation', 'SECURITY_VIOLATION');
            }
            
            await client.query('ROLLBACK');
            return sendError(res, 401, 'Invalid or expired session');
        }

        // 4. Perform Rotation & Heartbeat
        // If we matched the current JTI, we perform a full rotation.
        // If we matched a grace-period JTI, we return the existing current tokens to synchronize the tab.
        let accessToken = '';
        let newRefreshToken = '';

        if (isCurrentJti) {
            const newAccessJti = crypto.randomBytes(16).toString('hex');
            const newRefreshJti = crypto.randomBytes(16).toString('hex');

            // Calculate new expiration (Sliding Window)
            const timeoutMinutes = await getSessionTimeoutMinutes();
            const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

            await client.query(
                `UPDATE user_sessions 
                 SET previous_refresh_token_jti = refresh_token_jti,
                     previous_access_token_jti = access_token_jti,
                     refresh_token_jti = $1, 
                     access_token_jti = $2,
                     jti_rotated_at = CURRENT_TIMESTAMP,
                     last_activity = CURRENT_TIMESTAMP,
                     expires_at = $3
                 WHERE session_id = $4`,
                [newRefreshJti, newAccessJti, expiresAt, sessionId]
            );

            accessToken = jwt.sign(
                {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    tokenVersion: user.token_version,
                    jti: newAccessJti,
                    sessionId: sessionId
                },
                getJwtSecret(),
                { expiresIn: await getJwtAccessExpiry() }
            );

            newRefreshToken = jwt.sign(
                {
                    id: user.id,
                    tokenVersion: user.token_version,
                    jti: newRefreshJti,
                    sessionId: sessionId
                },
                getJwtSecret(),
                { expiresIn: await getJwtRefreshExpiry() }
            );

            await auditService.log({
                userId: user.id,
                action: 'TOKEN_REFRESH',
                ipAddress: req.ip,
                userAgent: getUA(req),
                sessionId: sessionId,
                accessTokenJti: newAccessJti,
                refreshTokenJti: newRefreshJti
            });

            observabilityService.logTokenRefresh({
                sessionId: sessionId,
                userId: user.id,
                timestamp: new Date().toISOString(),
                source: 'backend'
            });
        } else {
            // Grace Period Match: Return current tokens to re-sync the tab
            logger.info('Grace window hit, synchronizing tab with current session', { userId: user.id, sessionId });
            
            // Note: In this case, we don't have the current JTIs in the JWT payload of the OLD token.
            // We must generate new tokens for this tab that match the CURRENT JTIs in the database.
            accessToken = jwt.sign(
                {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    tokenVersion: user.token_version,
                    jti: session.access_token_jti,
                    sessionId: sessionId
                },
                getJwtSecret(),
                { expiresIn: await getJwtAccessExpiry() }
            );

            newRefreshToken = jwt.sign(
                {
                    id: user.id,
                    tokenVersion: user.token_version,
                    jti: session.refresh_token_jti,
                    sessionId: sessionId
                },
                getJwtSecret(),
                { expiresIn: await getJwtRefreshExpiry() }
            );
        }

        await client.query('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
        await client.query('COMMIT');

        const timeoutMinutes = await getSessionTimeoutMinutes();

        return sendResponse(res, 200, true, 'Token refreshed successfully', {
            token: accessToken,
            refreshToken: newRefreshToken,
            serverTime: new Date().toISOString(),
            sessionTimeout: timeoutMinutes
        });

    } catch (err: unknown) {
        await client.query('ROLLBACK');
        const errorMessage = err instanceof Error ? err.name : 'UnknownError';
        if (errorMessage === 'TokenExpiredError') {
            return sendResponse(res, 401, false, 'Session expired. Please log in again.');
        }
        logger.error('[Auth.RefreshToken] Detailed failure', {
            error: err instanceof Error ? err.message : String(err),
            userId: decoded?.id || 'unknown'
        });
        return sendResponse(res, 401, false, 'Invalid session');
    } finally {
        client.release();
    }
};

export const logout = async (req: Request, res: Response) => {
    try {
        const user = req.user as JWTPayload;
        
        // CRITICAL: Increment token_version in DB to invalidate ALL outstanding refresh tokens
        if (user?.id) {
            // Revoke current session in user_sessions
            if (user.sessionId) {
                await pool.query(
                    'UPDATE user_sessions SET revoked = TRUE, logout_time = CURRENT_TIMESTAMP WHERE session_id = $1',
                    [user.sessionId]
                );
            }

            // Fallback: Increment token_version for radical invalidation
            // Institutional Fix: Use COALESCE to protect against NULL drifts
            await pool.query(
                'UPDATE users SET token_version = COALESCE(token_version, 0) + 1, last_activity = CURRENT_TIMESTAMP WHERE id = $1',
                [user.id]
            );

            await auditService.log({
                userId: user.id,
                action: 'LOGOUT',
                ipAddress: req.ip,
                userAgent: getUA(req),
                sessionId: user.sessionId
            });

            observabilityService.logSessionEnd({
                sessionId: user.sessionId || null,
                userId: user.id,
                timestamp: new Date().toISOString(),
                source: 'backend'
            });

            // P0 NUCLEAR: Atomic Presence Purge on Logout
            // This ensures the user is marked offline in the DB truth source immediately
            await statusService.purgeUserConnections(user.id);
        }
    } catch (dbError: unknown) {
        // Log but do not block logout (Enterpise Resilience)
        logger.error('[Auth] Idempotent logout DB failure (Graceful skip):', {
            error: dbError instanceof Error ? dbError.message : String(dbError),
            userId: req.user?.id
        });
    }

    return sendResponse(res, 200, true, 'Logged out successfully');
};

export const heartbeat = async (req: Request, res: Response) => {
    // Accessing this endpoint triggers the authenticateToken middleware, 
    // which updates the session heartbeat (last_activity and expires_at).
    return sendResponse(res, 200, true, 'Heartbeat successful', {
        timestamp: new Date().toISOString()
    });
};

export const verifySession = async (req: Request, res: Response) => {
    const user = req.user as JWTPayload;
    try {
        const timeoutMinutes = await getSessionTimeoutMinutes();
        
        // Fetch fresh user data to ensure mapUserToResponse integrity
        const dbUser = await userRepository.findById(user.id);
        if (!dbUser) return sendError(res, 401, 'User not found');

        return sendResponse(res, 200, true, 'Session valid', { 
            user: mapUserToResponse(dbUser),
            serverTime: new Date().toISOString(),
            sessionTimeout: timeoutMinutes
        });
    } catch (err: unknown) {
        logger.error('[Auth.VerifySession] Failure', {
            error: err instanceof Error ? err.message : String(err),
            userId: user?.id
        });
        return sendError(res, 500, 'Server error');
    }
};

export const getMe = async (req: Request, res: Response) => {
    try {
        const user = req.user as JWTPayload;
        if (!user) return sendResponse(res, 200, true, 'User not authenticated', { authenticated: false, user: null });
        
        const dbUser = await userRepository.findById(user.id);
        
        return sendResponse(res, 200, true, 'User data fetched', {
            authenticated: !!user,
            user: dbUser ? mapUserToResponse(dbUser) : null
        });
    } catch (err: unknown) {
        logger.error('[Auth.GetMe] Failure', {
            error: err instanceof Error ? err.message : String(err),
            userId: (req.user as JWTPayload)?.id
        });
        return sendError(res, 500, 'Server error');
    }
};
