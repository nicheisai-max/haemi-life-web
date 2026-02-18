import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { userRepository } from '../repositories/user.repository';
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

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                token_version: user.token_version // CRITICAL: Bind token to specific version
            },
            process.env.JWT_SECRET as string,
            { expiresIn: '12h' }
        );

        res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name, status: user.status, profile_image: user.profile_image } });
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
        const imagePath = `/uploads/profiles/${req.file.filename}`;

        const updatedUser = await userRepository.updateProfileImage(userId, imagePath);

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

export const verifySession = async (req: any, res: Response) => {
    try {
        const userId = req.user.id;
        const tokenVersion = req.user.token_version;

        // Verify user still exists and is active
        const user = await userRepository.findById(userId);

        if (!user) {
            return res.status(401).json({ message: 'User no longer exists' });
        }

        // STRICT STATUS CHECK
        if (user.status !== 'ACTIVE') {
            return res.status(403).json({ message: `Account is ${user.status.toLowerCase()}` });
        }

        // V6 FIX: Token version check — detects revoked tokens.
        // When a user changes their password or an admin revokes a session,
        // token_version is incremented in the DB. Any JWT with an older version
        // is immediately rejected, even if it hasn't expired yet.
        if (tokenVersion !== undefined && user.token_version !== undefined) {
            if (tokenVersion !== user.token_version) {
                logger.auth('Token version mismatch — session revoked', { userId, tokenVersion, dbVersion: user.token_version });
                return res.status(401).json({ message: 'Session has been revoked. Please log in again.' });
            }
        }

        res.json({ message: 'Session valid', user });
    } catch (error) {
        logger.error('Error verifying session', { error });
        res.status(500).json({ message: 'Server error' });
    }
};

