import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { logger } from '../utils/logger';
import { auditService } from '../services/audit.service';

export const signup = async (req: Request, res: Response) => {
    const { email, password, role, name, phone_number, id_number } = req.body;

    try {
        // Check if user exists (by phone or email if provided)
        const query = email
            ? 'SELECT * FROM users WHERE phone_number = $1 OR email = $2'
            : 'SELECT * FROM users WHERE phone_number = $1';
        const params = email ? [phone_number, email] : [phone_number];

        const userCheck = await pool.query(query, params);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ message: 'User already exists with this phone number or email' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const newUser = await client.query(
                `INSERT INTO users (
            name, phone_number, email, password, role, id_number, created_at, updated_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), 'ACTIVE') RETURNING id, email, role, name, phone_number, status`,
                [name, phone_number, email || null, hashedPassword, role, id_number || null]
            );

            // Handle role specific data insertion here (dummy logic for now)
            // if (role === 'doctor') { ... }

            await client.query('COMMIT');

            res.status(201).json({ message: 'User created successfully', user: newUser.rows[0] });
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
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR phone_number = $1',
            [identifier]
        );

        if (result.rows.length === 0) {
            // Audit failed attempt (unknown user)
            await auditService.log({
                action_type: 'LOGIN_FAILED',
                metadata: { reason: 'User not found', identifier },
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            });
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const user = result.rows[0];

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

        const validPassword = await bcrypt.compare(password, user.password);

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

        res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name, status: user.status } });
    } catch (error) {
        logger.error('Login server error', { error, identifier });
        res.status(500).json({ message: 'Server error' });
    }
};

export const getProfile = async (req: any, res: Response) => {
    try {
        const userId = req.user.id;
        const result = await pool.query('SELECT id, name, email, phone_number, role, id_number, is_active, created_at FROM users WHERE id = $1', [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateProfile = async (req: any, res: Response) => {
    try {
        const userId = req.user.id;
        const { name, email, phone_number } = req.body;

        const result = await pool.query(
            'UPDATE users SET name = $1, email = $2, phone_number = $3, updated_at = NOW() WHERE id = $4 RETURNING id, name, email, phone_number, role',
            [name, email, phone_number, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const changePassword = async (req: any, res: Response) => {
    try {
        const userId = req.user.id;
        const { current_password, new_password } = req.body;

        // Get current password hash
        const result = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(current_password, user.password);

        if (!validPassword) {
            return res.status(400).json({ message: 'Invalid current password' });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);

        await pool.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, userId]);

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const verifySession = async (req: any, res: Response) => {
    try {
        const userId = req.user.id;
        // Verify user still exists and is active
        const result = await pool.query('SELECT id, name, email, role, status FROM users WHERE id = $1', [userId]);

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'User no longer exists' });
        }

        const user = result.rows[0];

        // STRICT STATUS CHECK
        if (user.status !== 'ACTIVE') {
            return res.status(403).json({ message: `Account is ${user.status.toLowerCase()}` });
        }

        res.json({ message: 'Session valid', user });
    } catch (error) {
        console.error('Error verifying session:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
