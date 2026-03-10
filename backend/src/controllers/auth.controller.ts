import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { userRepository } from '../repositories/user.repository';
import { logger } from '../utils/logger';
import { auditService } from '../services/audit.service';
import { sendResponse, sendError } from '../utils/response';
import { JWTPayload } from '../types/express';
import crypto from 'crypto';

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

            await pool.query(
                `INSERT INTO user_sessions (user_id, user_role, session_id, access_token_jti, refresh_token_jti, ip_address, user_agent, device_type)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [newUser.id, newUser.role, sessionId, accessJti, refreshJti, req.ip, req.headers['user-agent'], 'web']
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
                process.env.JWT_SECRET as string,
                { expiresIn: '15m' }
            );

            // Generate Refresh Token (7d)
            const refreshToken = jwt.sign(
                {
                    id: newUser.id,
                    token_version: newUser.token_version,
                    jti: refreshJti,
                    session_id: sessionId
                },
                process.env.JWT_SECRET as string,
                { expiresIn: '7d' }
            );

            // Audit
            await auditService.log({
                actor_id: newUser.id,
                action_type: 'SIGNUP_SUCCESS',
                ip_address: req.ip,
                user_agent: req.headers['user-agent'] as string,
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
                actor_id: user.id,
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
                actor_id: user.id,
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

        // Persistent Session record
        await pool.query(
            `INSERT INTO user_sessions (user_id, user_role, session_id, access_token_jti, refresh_token_jti, ip_address, user_agent, device_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [user.id, user.role, sessionId, accessJti, refreshJti, req.ip, req.headers['user-agent'], 'web']
        );

        // Audit Successful Login
        await auditService.log({
            actor_id: user.id,
            actor_role: user.role,
            action_type: 'LOGIN_SUCCESS',
            ip_address: req.ip,
            user_agent: req.headers['user-agent'] as string,
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
            process.env.JWT_SECRET as string,
            { expiresIn: '15m' }
        );

        // Generate Refresh Token (7d)
        const refreshToken = jwt.sign(
            {
                id: user.id,
                token_version: user.token_version,
                jti: refreshJti,
                session_id: sessionId
            },
            process.env.JWT_SECRET as string,
            { expiresIn: '7d' }
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

        return sendResponse(res, 200, true, 'Login successful', {
            token: accessToken,
            refreshToken: refreshToken,
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
            user: updatedUser
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
        const decoded = jwt.verify(refreshTokenHeader, process.env.JWT_SECRET as string) as JWTPayload;

        // 2. Fetch User and Session state with row-level locking
        const userRes = await client.query(
            'SELECT id, status, token_version, email, role FROM users WHERE id = $1 FOR UPDATE',
            [decoded.id]
        );
        const user = userRes.rows[0];

        if (!user || user.status !== 'ACTIVE') {
            await client.query('ROLLBACK');
            return sendResponse(res, 200, false, 'Invalid session');
        }

        const sessionId = decoded.session_id;
        const sessionRes = await client.query(
            'SELECT refresh_token_jti, revoked FROM user_sessions WHERE session_id = $1 FOR UPDATE',
            [sessionId]
        );
        const session = sessionRes.rows[0];

        // 3. Security Check: Token Rotation & Versioning
        // We check BOTH the jti (rotation) and token_version (emergency revocation)
        const isVersionMismatch = decoded.token_version !== undefined && decoded.token_version !== user.token_version;
        const isJtiMismatch = decoded.jti && session && decoded.jti !== session.refresh_token_jti;

        if (isVersionMismatch || isJtiMismatch || !session || session.revoked) {
            logger.warn('Token rotation violation detected', {
                userId: user.id,
                sessionId,
                reason: isVersionMismatch ? 'version_mismatch' : isJtiMismatch ? 'jti_mismatch' : 'revoked_session'
            });

            // On violation: Force revoke all sessions by incrementing version
            await client.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [user.id]);
            await client.query('UPDATE user_sessions SET revoked = TRUE WHERE session_id = $1', [sessionId]);
            await client.query('COMMIT');
            return sendResponse(res, 401, false, 'Session revoked due to security violation');
        }

        // 4. Perform Rotation & Heartbeat
        const newAccessJti = crypto.randomBytes(16).toString('hex');
        const newRefreshJti = crypto.randomBytes(16).toString('hex');

        await client.query(
            `UPDATE user_sessions 
             SET access_token_jti = $1, refresh_token_jti = $2, last_activity = CURRENT_TIMESTAMP 
             WHERE session_id = $3`,
            [newAccessJti, newRefreshJti, sessionId]
        );

        await client.query('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        await client.query('COMMIT');

        // 5. Generate New Token Pair
        const accessToken = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                token_version: user.token_version,
                jti: newAccessJti,
                session_id: sessionId
            },
            process.env.JWT_SECRET as string,
            { expiresIn: '15m' }
        );

        const newRefreshToken = jwt.sign(
            {
                id: user.id,
                token_version: user.token_version,
                jti: newRefreshJti,
                session_id: sessionId
            },
            process.env.JWT_SECRET as string,
            { expiresIn: '7d' }
        );

        // Audit Refresh
        await auditService.log({
            actor_id: user.id,
            action_type: 'TOKEN_REFRESH',
            ip_address: req.ip,
            user_agent: req.headers['user-agent'] as string,
            session_id: sessionId,
            access_token_jti: newAccessJti,
            refresh_token_jti: newRefreshJti
        });

        return sendResponse(res, 200, true, 'Token refreshed successfully', {
            token: accessToken,
            refreshToken: newRefreshToken
        });

    } catch (err: unknown) {
        await client.query('ROLLBACK');
        const error = err as Error;
        if (error.name === 'TokenExpiredError') {
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
                    'UPDATE user_sessions SET revoked = TRUE, revoked_at = NOW() WHERE session_id = $1',
                    [req.user.session_id]
                );
            }

            // Fallback: Increment token_version for radical invalidation
            await pool.query(
                'UPDATE users SET token_version = token_version + 1, last_activity = CURRENT_TIMESTAMP WHERE id = $1',
                [req.user.id]
            );

            await auditService.log({
                actor_id: req.user.id,
                action_type: 'LOGOUT',
                ip_address: req.ip,
                user_agent: req.headers['user-agent'] as string,
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

export const verifySession = async (req: Request, res: Response) => {
    try {
        const user = req.user;
        return sendResponse(res, 200, true, 'Session valid', { user });
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
