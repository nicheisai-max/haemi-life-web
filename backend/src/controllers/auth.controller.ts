import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { userRepository } from '../repositories/user.repository';
import { systemSettingsRepository } from '../repositories/system_settings.repository';
import { logger } from '../utils/logger';
import { auditService } from '../services/audit.service';
import { sendResponse, sendError } from '../utils/response';

export const signup = async (req: Request, res: Response) => {
    const { email, password, role, name, phone_number, id_number } = req.body;

    // Institutional Hardening: Input Validation
    if (!email || !password || !role || !name || !phone_number) {
        return sendError(res, 400, 'Missing required fields (name, email, phone, password, role)');
    }

    try {
        // Check if user exists (by phone or email if provided)
        const userCheck = await userRepository.findByPhoneOrEmail(phone_number, email);
        if (userCheck) {
            return sendError(res, 400, 'User already exists with this phone number or email');
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

            // Generate Access Token (15m)
            const accessToken = jwt.sign(
                { id: newUser.id, email: newUser.email, role: newUser.role, token_version: newUser.token_version },
                process.env.JWT_SECRET as string,
                { expiresIn: '15m' }
            );

            // Generate Refresh Token (7d)
            const refreshToken = jwt.sign(
                { id: newUser.id, token_version: newUser.token_version },
                process.env.JWT_SECRET as string,
                { expiresIn: '7d' }
            );

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            await pool.query('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1', [newUser.id]);

            return sendResponse(res, 201, true, 'User created successfully', {
                token: accessToken,
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
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
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
            return sendError(res, 400, 'Invalid credentials');
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
            return sendError(res, 400, 'Invalid credentials');
        }

        // Audit Successful Login
        await auditService.log({
            actor_id: user.id,
            actor_role: user.role,
            action_type: 'LOGIN_SUCCESS',
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        logger.auth('Successful login', { userId: user.id, email: user.email, role: user.role });

        // Update last_activity directly so the middleware doesn't instantly invalidate the new session
        await pool.query('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        // Generate Access Token (15m)
        const accessToken = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                token_version: user.token_version
            },
            process.env.JWT_SECRET as string,
            { expiresIn: '15m' }
        );

        // Generate Refresh Token (7d)
        const refreshToken = jwt.sign(
            {
                id: user.id,
                token_version: user.token_version
            },
            process.env.JWT_SECRET as string,
            { expiresIn: '7d' }
        );

        // Send Refresh Token as HTTP-Only Cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // Update activity heartbeat on login
        await pool.query('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        return sendResponse(res, 200, true, 'Login successful', {
            token: accessToken,
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
    } catch (error) {
        logger.error('Login server error', { error, identifier });
        return sendError(res, 500, 'Server error');
    }
};

export const getProfile = async (req: any, res: Response) => {
    try {
        const userId = req.user.id;
        const user = await userRepository.findById(userId);

        if (!user) {
            return sendError(res, 404, 'User not found');
        }

        return sendResponse(res, 200, true, 'Profile fetched', user);
    } catch (error) {
        console.error('Error fetching profile:', error);
        return sendError(res, 500, 'Server error');
    }
};

export const updateProfile = async (req: any, res: Response) => {
    try {
        const userId = req.user.id;
        const { name, email, phone_number } = req.body;

        const updatedUser = await userRepository.updateProfile(userId, { name, email, phone_number });

        if (!updatedUser) {
            return sendError(res, 404, 'User not found');
        }

        return sendResponse(res, 200, true, 'Profile updated', updatedUser);
    } catch (error) {
        console.error('Error updating profile:', error);
        return sendError(res, 500, 'Server error');
    }
};

export const uploadProfileImage = async (req: any, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const userId = req.user.id;
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
    } catch (error: any) {
        console.error('Error uploading profile image:', error);
        return sendError(res, 500, 'Server error during upload process');
    }
};

export const changePassword = async (req: any, res: Response) => {
    try {
        const userId = req.user.id;
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
    } catch (error) {
        console.error('Error changing password:', error);
        return sendError(res, 500, 'Server error');
    }
};

export const refreshToken = async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return sendResponse(res, 200, false, 'No active session');
    }

    try {
        const decoded: any = jwt.verify(refreshToken, process.env.JWT_SECRET as string);

        const user = await userRepository.findById(decoded.id);

        if (!user || user.status !== 'ACTIVE') {
            res.clearCookie('refreshToken');
            return sendResponse(res, 200, false, 'Invalid session');
        }

        // Session Replay Protection
        if (decoded.token_version !== user.token_version) {
            // If a token reuse is detected, invalidate all current sessions for the user
            await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [user.id]);
            res.clearCookie('refreshToken');
            return sendResponse(res, 200, false, 'Session revoked due to reuse detection');
        }

        // Token Renewal: Update last_activity only.
        // token_version is NOT incremented here — only on security events
        // (password change, explicit logout, admin revocation) to prevent
        // cascading 401 storms from concurrent requests during token refresh.
        await pool.query(
            'UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        const accessToken = jwt.sign(
            { id: user.id, email: user.email, role: user.role, token_version: user.token_version },
            process.env.JWT_SECRET as string,
            { expiresIn: '15m' }
        );

        const newRefreshToken = jwt.sign(
            { id: user.id, token_version: user.token_version },
            process.env.JWT_SECRET as string,
            { expiresIn: '7d' }
        );

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return sendResponse(res, 200, true, 'Token refreshed', { token: accessToken });
    } catch (error) {
        res.clearCookie('refreshToken');
        return sendResponse(res, 200, false, 'Invalid refresh token');
    }
};

export const logout = async (req: any, res: Response) => {
    try {
        // CRITICAL: Increment token_version in DB to invalidate ALL outstanding refresh tokens
        // for this user — regardless of which browser, tab, or device holds them.
        // The Session Replay Protection check in refreshToken() rejects any token whose
        // embedded token_version no longer matches the DB value.
        if (req.user?.id) {
            await pool.query(
                'UPDATE users SET token_version = token_version + 1, last_activity = CURRENT_TIMESTAMP WHERE id = $1',
                [req.user.id]
            );
        }
    } catch (dbError) {
        // Log but do not block logout — clearing the cookie is still the primary action
        console.error('[Auth] Failed to increment token_version on logout:', dbError);
    }

    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    return sendResponse(res, 200, true, 'Logged out successfully');
};

export const verifySession = async (req: any, res: Response) => {
    try {
        const user = req.user;
        return sendResponse(res, 200, true, 'Session valid', { user });
    } catch (error) {
        return sendError(res, 500, 'Server error');
    }
};

export const getMe = async (req: any, res: Response) => {
    try {
        return sendResponse(res, 200, true, 'User data fetched', {
            authenticated: !!req.user,
            user: req.user || null
        });
    } catch (error) {
        return sendError(res, 500, 'Server error');
    }
};

