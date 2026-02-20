import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { userRepository } from '../repositories/user.repository';
import { systemSettingsRepository } from '../repositories/system_settings.repository';
import { logger } from '../utils/logger';
import { auditService } from '../services/audit.service';

export const signup = async (req: Request, res: Response) => {
    const { email, password, role, name, phone_number, id_number } = req.body;

    try {
        // Check if user exists (by phone or email if provided)
        const userCheck = await userRepository.findByPhoneOrEmail(phone_number, email);
        if (userCheck) {
            return res.status(400).json({ message: 'User already exists with this phone number or email' });
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
                email: email || null,
                password: hashedPassword,
                role,
                id_number: id_number || null
            }, client);

            // Handle role specific data insertion here (dummy logic for now)
            // if (role === 'doctor') { ... }

            await client.query('COMMIT');

            res.status(201).json({ message: 'User created successfully', user: newUser });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        logger.error('Error creating user', { error, email, phone_number, role });
        res.status(500).json({ message: 'Error creating user' });
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
            return res.status(400).json({ message: 'Invalid credentials' });
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
            return res.status(403).json({ message: 'Account is not active. Please contact support.' });
        }

        const validPassword = await bcrypt.compare(password, user.password!);

        if (!validPassword) {
            await auditService.log({
                actor_id: user.id,
                actor_role: user.role, // Log role even on failure if user known
                action_type: 'LOGIN_FAILED',
                metadata: { reason: 'Invalid password' },
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            });
            logger.auth('Failed login attempt: Invalid password', { identifier, ip: req.ip });
            return res.status(400).json({ message: 'Invalid credentials' });
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
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Update activity heartbeat on login
        await pool.query('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        res.json({
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
        res.status(500).json({ message: 'Server error' });
    }
};

export const getProfile = async (req: any, res: Response) => {
    try {
        const userId = req.user.id;
        const user = await userRepository.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateProfile = async (req: any, res: Response) => {
    try {
        const userId = req.user.id;
        const { name, email, phone_number } = req.body;

        const updatedUser = await userRepository.updateProfile(userId, { name, email, phone_number });

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(updatedUser);
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Server error' });
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
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            message: 'Profile image updated successfully',
            user: updatedUser
        });
    } catch (error: any) {
        console.error('Error uploading profile image:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during upload process'
        });
    }
};

export const changePassword = async (req: any, res: Response) => {
    try {
        const userId = req.user.id;
        const { current_password, new_password } = req.body;

        // Get current password hash
        const passwordHash = await userRepository.getPasswordHash(userId);
        if (!passwordHash) {
            return res.status(404).json({ message: 'User not found' });
        }

        const validPassword = await bcrypt.compare(current_password, passwordHash);

        if (!validPassword) {
            return res.status(400).json({ message: 'Invalid current password' });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);

        await userRepository.updatePassword(userId, hashedPassword);

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const refreshToken = async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        // Return 200 OK with authenticated: false instead of 401 to prevent browser console error spam on boot
        return res.status(200).json({ authenticated: false, message: 'No active session' });
    }

    try {
        const decoded: any = jwt.verify(refreshToken, process.env.JWT_SECRET as string);

        // Verify user exists and token version matches
        const user = await userRepository.findById(decoded.id);

        if (!user || user.status !== 'ACTIVE') {
            res.clearCookie('refreshToken');
            return res.status(200).json({ authenticated: false, message: 'Invalid session' });
        }

        if (decoded.token_version !== user.token_version) {
            res.clearCookie('refreshToken');
            return res.status(200).json({ authenticated: false, message: 'Session revoked' });
        }

        // Issue new Access Token (15m)
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

        // Update activity heartbeat on refresh
        await pool.query('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        res.json({ authenticated: true, token: accessToken });
    } catch (error) {
        res.clearCookie('refreshToken');
        return res.status(200).json({ authenticated: false, message: 'Invalid refresh token' });
    }
};

export const logout = async (req: Request, res: Response) => {
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
};

export const verifySession = async (req: any, res: Response) => {
    try {
        // Just verify the access token from the middleware
        const user = req.user;
        res.json({ message: 'Session valid', user });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

