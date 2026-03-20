import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { userRepository } from '../repositories/user.repository';
import { logger } from '../utils/logger';
import { auditService, SYSTEM_ANONYMOUS_ID } from '../services/audit.service';
import { getSessionTimeoutMinutes, getJwtAccessExpiry, getJwtRefreshExpiry } from '../utils/config.util';
import { parseUA } from '../utils/ua-parser.util';
import { sendResponse, sendError } from '../utils/response';
import crypto from 'crypto';
import { isJWTPayloadStrict } from '../utils/type-guards';

const getJwtSecret = (): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      logger.error('CRITICAL: JWT_SECRET is not configured in environment variables');
      return 'UNSET_SECRET_INTERNAL_FAILSAFE';
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
    const { email, password, role, name, phone_number, id_number } = req.body;

    // Institutional Hardening: Input Validation
    if (!email || !password || !role || !name || !phone_number) {
        return sendError(res, 400, 'Missing required fields (name, email, phone, password, role)', 'MISSING_FIELDS');
    }

    try {
        // Check if user exists (by phone or email if provided)
        const userCheck = await userRepository.findByPhoneOrEmail(phone_number, email);
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
                phone_number,
                email,
                password: hashedPassword,
                role,
                id_number: id_number || null
            }, client);

            await client.query('COMMIT');

            // PHASE 1: Persistent Session record
            const sessionId = crypto.randomUUID();
            const accessJti = crypto.randomBytes(16).toString('hex');
            const refreshJti = crypto.randomBytes(16).toString('hex');

            const userAgent = getUA(req);
            const { browser, os, device } = parseUA(userAgent);

            await pool.query(
                `INSERT INTO user_sessions (user_id, user_role, session_id, access_token_jti, refresh_token_jti, ip_address, user_agent, browser_name, os_name, device_type)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [newUser.id, newUser.role, sessionId, accessJti, refreshJti, req.ip, userAgent, browser, os, device]
            );

            // Generate Access Token (15m)
            const accessToken = jwt.sign(
                {
                    id: newUser.id,
                    email: newUser.email,
                    role: newUser.role,
                    token_version: newUser.token_version,
                    jti: accessJti,
                    session_id: sessionId
                },
                getJwtSecret(),
                { expiresIn: await getJwtAccessExpiry() }
            );

            // Generate Refresh Token (7d)
            const refreshToken = jwt.sign(
                {
                    id: newUser.id,
                    token_version: newUser.token_version,
                    jti: refreshJti,
                    session_id: sessionId
                },
                getJwtSecret(),
                { expiresIn: await getJwtRefreshExpiry() }
            );

            // Audit
            await auditService.log({
                user_id: newUser.id,
                action_type: 'SIGNUP_SUCCESS',
                ip_address: req.ip,
                user_agent: userAgent,
                session_id: sessionId,
                access_token_jti: accessJti,
                refresh_token_jti: refreshJti
            });

            /* 
               PATCH: Removing cookie-based refresh token for multi-tab isolation.
               Now returning refreshToken in the JSON response body.
            */
            // res.cookie('refreshToken', refreshToken, {
            //     httpOnly: true,
            //     secure: process.env.NODE_ENV === 'production',
            //     sameSite: 'strict',
            //     path: '/',
            //     maxAge: 7 * 24 * 60 * 60 * 1000
            // });

            await pool.query('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1', [newUser.id]);

            return sendResponse(res, 201, true, 'User created successfully', {
                token: accessToken,
                refreshToken: refreshToken,
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    role: newUser.role,
                    name: newUser.name,
                    status: newUser.status,
                    initials: newUser.initials,
                    profile_image: newUser.profile_image
                }
            });
        } catch (e: unknown) {
            await client.query('ROLLBACK');
            logger.error('Signup transaction failed', e);
            throw e;
        } finally {
            client.release();
        }
    } catch (error: unknown) {
        logger.error('Error creating user', { error, email, phone_number, role });
        return sendError(res, 500, 'Error creating user');
    }
};

export const login = async (req: Request, res: Response) => {
    const { identifier, password } = req.body;

    try {
        // Unified query: Check if identifier matches email OR phone_number
        const user = await userRepository.findByEmailOrPhone(identifier);

        if (!user) {
            // Audit failed attempt (unknown user)
            await auditService.log({
                user_id: SYSTEM_ANONYMOUS_ID,
                action_type: 'LOGIN_FAILED',
                metadata: { reason: 'User not found', identifier },
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            });
            return sendError(res, 400, 'Invalid credentials', 'INVALID_CREDENTIALS');
        }

        // STRICT STATUS CHECK
        if (user.status !== 'ACTIVE') {
            await auditService.log({
                user_id: user.id,
                actor_role: user.role,
                action_type: 'LOGIN_DENIED',
                metadata: { reason: `User status is ${user.status}` },
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            });
            return sendError(res, 403, 'Account is not active. Please contact support.');
        }

        const validPassword = await bcrypt.compare(password, user.password!);

        if (!validPassword) {
            await auditService.log({
                user_id: user.id,
                actor_role: user.role,
                action_type: 'LOGIN_FAILED',
                metadata: { reason: 'Invalid password' },
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
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
        await pool.query(
            `INSERT INTO user_sessions (user_id, user_role, session_id, access_token_jti, refresh_token_jti, ip_address, user_agent, browser_name, os_name, device_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [user.id, user.role, sessionId, accessJti, refreshJti, req.ip, userAgent, browser, os, device]
        );

        // Audit Successful Login
        await auditService.log({
            user_id: user.id,
            actor_role: user.role,
            action_type: 'LOGIN_SUCCESS',
            ip_address: req.ip,
            user_agent: userAgent,
            session_id: sessionId,
            access_token_jti: accessJti,
            refresh_token_jti: refreshJti
        });

        logger.auth('Successful login', { userId: user.id, email: user.email, role: user.role });


        // Generate Access Token (15m)
        const accessToken = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                token_version: user.token_version,
                jti: accessJti,
                session_id: sessionId
            },
            getJwtSecret(),
            { expiresIn: await getJwtAccessExpiry() }
        );

        // Generate Refresh Token (7d)
        const refreshToken = jwt.sign(
            {
                id: user.id,
                token_version: user.token_version,
                jti: refreshJti,
                session_id: sessionId
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
        //     sameSite: 'strict',
        //     path: '/',
        //     maxAge: 7 * 24 * 60 * 60 * 1000
        // });

        // Update activity heartbeat on login
        await pool.query('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        const timeoutMinutes = await getSessionTimeoutMinutes();

        return sendResponse(res, 200, true, 'Login successful', {
            token: accessToken,
            refreshToken: refreshToken,
            serverTime: new Date().toISOString(),
            sessionTimeout: timeoutMinutes,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
                status: user.status,
                initials: user.initials,
                profile_image: user.profile_image
            }
        });
    } catch (error: unknown) {
        logger.error('Login server error', { error, identifier });
        return sendError(res, 500, 'Server error', 'SERVER_ERROR', error);
    }
};

export const getProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return sendError(res, 401, 'Unauthorized');
        const user = await userRepository.findById(userId);

        if (!user) {
            return sendError(res, 404, 'User not found');
        }

        return sendResponse(res, 200, true, 'Profile fetched', user);
    } catch (error: unknown) {
        logger.error('Error fetching profile:', error);
        return sendError(res, 500, 'Server error');
    }
};

export const updateProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return sendError(res, 401, 'Unauthorized');
        const { name, email, phone_number } = req.body;

        const updatedUser = await userRepository.updateProfile(userId, { name, email, phone_number });

        if (!updatedUser) {
            return sendError(res, 404, 'User not found');
        }

        return sendResponse(res, 200, true, 'Profile updated', updatedUser);
    } catch (error: unknown) {
        logger.error('Error updating profile:', error);
        return sendError(res, 500, 'Server error');
    }
};

export const uploadProfileImage = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
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
            user: {
                ...updatedUser,
                profile_image: updatedUser.profile_image
            }
        });
    } catch (error: unknown) {
        logger.error('Error uploading profile image', { userId: req.user?.id, error });
        return sendError(res, 500, 'Server error during upload process');
    }
};

export const changePassword = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return sendError(res, 401, 'Unauthorized');
        const { current_password, new_password } = req.body;

        // Get current password hash
        const passwordHash = await userRepository.getPasswordHash(userId);
        if (!passwordHash) {
            return sendError(res, 404, 'User not found');
        }

        const validPassword = await bcrypt.compare(current_password, passwordHash);

        if (!validPassword) {
            return sendError(res, 400, 'Invalid current password');
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);

        await userRepository.updatePassword(userId, hashedPassword);

        return sendResponse(res, 200, true, 'Password updated successfully');
    } catch (error: unknown) {
        logger.error('Error changing password:', error);
        return sendError(res, 500, 'Server error');
    }
};

export const refreshToken = async (req: Request, res: Response) => {
    const refreshTokenHeader = req.body.refreshToken;

    if (!refreshTokenHeader) {
        return sendResponse(res, 200, false, 'No active session');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Verify token signature and basic expiration
        const decoded = jwt.verify(refreshTokenHeader, getJwtSecret());
        if (!isJWTPayloadStrict(decoded)) {
            await client.query('ROLLBACK');
            return sendError(res, 401, 'Invalid session structure');
        }

        // 2. Fetch User and Session state with row-level locking
        const userRes = await client.query(
            'SELECT id, status, token_version, email, role FROM users WHERE id = $1 FOR UPDATE',
            [decoded.id]
        );
        const user = userRes.rows[0];

        if (!user || user.status !== 'ACTIVE') {
            await client.query('ROLLBACK');
            return sendError(res, 401, 'Invalid session');
        }

        const sessionId = decoded.session_id;

        if (!sessionId) {
            logger.error('[Security] Refresh token missing session_id', { userId: decoded.id });
            await client.query('ROLLBACK');
            return sendResponse(res, 401, false, 'Invalid token structure');
        }

        // Phase 7: Apply Rate Limiting
        if (!checkRefreshRateLimit(sessionId)) {
            logger.warn('[Security] Refresh rate limit exceeded', { sessionId, userId: decoded.id });
            await client.query('ROLLBACK');
            return sendError(res, 429, 'Too many refresh attempts. Please try again in a minute.');
        }

        const sessionRes = await client.query(
            `SELECT refresh_token_jti, previous_refresh_token_jti, jti_rotated_at, 
             access_token_jti, revoked, expires_at FROM user_sessions WHERE session_id = $1 FOR UPDATE`,
            [sessionId]
        );
        const session = sessionRes.rows[0];

        // 3. Security Check: Token Rotation & Versioning
        const isVersionMismatch = decoded.token_version !== undefined && decoded.token_version !== user.token_version;
        
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
                return sendResponse(res, 401, false, 'Session revoked due to security violation');
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
                    token_version: user.token_version,
                    jti: newAccessJti,
                    session_id: sessionId
                },
                getJwtSecret(),
                { expiresIn: await getJwtAccessExpiry() }
            );

            newRefreshToken = jwt.sign(
                {
                    id: user.id,
                    token_version: user.token_version,
                    jti: newRefreshJti,
                    session_id: sessionId
                },
                getJwtSecret(),
                { expiresIn: await getJwtRefreshExpiry() }
            );

            await auditService.log({
                user_id: user.id,
                action_type: 'TOKEN_REFRESH',
                ip_address: req.ip,
                user_agent: getUA(req),
                session_id: sessionId,
                access_token_jti: newAccessJti,
                refresh_token_jti: newRefreshJti
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
                    token_version: user.token_version,
                    jti: session.access_token_jti,
                    session_id: sessionId
                },
                getJwtSecret(),
                { expiresIn: await getJwtAccessExpiry() }
            );

            newRefreshToken = jwt.sign(
                {
                    id: user.id,
                    token_version: user.token_version,
                    jti: session.refresh_token_jti,
                    session_id: sessionId
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
        if (err instanceof Error && err.name === 'TokenExpiredError') {
            return sendResponse(res, 401, false, 'Session expired. Please log in again.');
        }
        logger.error('Refresh operation failed', err);
        return sendResponse(res, 401, false, 'Invalid session');
    } finally {
        client.release();
    }
};

export const logout = async (req: Request, res: Response) => {
    try {
        // CRITICAL: Increment token_version in DB to invalidate ALL outstanding refresh tokens
        if (req.user?.id) {
            // Revoke current session in user_sessions
            if (req.user.session_id) {
                await pool.query(
                    'UPDATE user_sessions SET revoked = TRUE, logout_time = NOW() WHERE session_id = $1',
                    [req.user.session_id]
                );
            }

            // Fallback: Increment token_version for radical invalidation
            await pool.query(
                'UPDATE users SET token_version = token_version + 1, last_activity = CURRENT_TIMESTAMP WHERE id = $1',
                [req.user.id]
            );

            await auditService.log({
                user_id: req.user.id,
                action_type: 'LOGOUT',
                ip_address: req.ip,
                user_agent: getUA(req),
                session_id: req.user.session_id
            });
        }
    } catch (dbError: unknown) {
        // Log but do not block logout
        logger.error('[Auth] Failed to increment token_version on logout:', dbError);
    }

    /* 
       PATCH: No longer clearing cookie on logout as we use body-based storage.
    */
    // res.clearCookie('refreshToken', {
    //     httpOnly: true,
    //     secure: process.env.NODE_ENV === 'production',
    //     sameSite: 'strict',
    //     path: '/'
    // });
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
    try {
        const user = req.user;
        const timeoutMinutes = await getSessionTimeoutMinutes();
        return sendResponse(res, 200, true, 'Session valid', { 
            user,
            serverTime: new Date().toISOString(),
            sessionTimeout: timeoutMinutes
        });
    } catch (err: unknown) {
        logger.error('Session verification failed', err);
        return sendError(res, 500, 'Server error');
    }
};

export const getMe = async (req: Request, res: Response) => {
    try {
        return sendResponse(res, 200, true, 'User data fetched', {
            authenticated: !!req.user,
            user: req.user || null
        });
    } catch (err: unknown) {
        logger.error('Get profile failed', err);
        return sendError(res, 500, 'Server error');
    }
};
