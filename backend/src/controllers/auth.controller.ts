import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';

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
            name, phone_number, email, password, role, id_number, created_at, updated_at, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), true) RETURNING id, email, role, name, phone_number`,
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
        console.error(error);
        res.status(500).json({ message: 'Error creating user' });
    }
};

export const login = async (req: Request, res: Response) => {
    const { email, phone_number, password } = req.body;

    try {
        let result;
        if (email) {
            result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        } else if (phone_number) {
            result = await pool.query('SELECT * FROM users WHERE phone_number = $1', [phone_number]);
        } else {
            return res.status(400).json({ message: 'Email or Phone number required' });
        }

        if (result.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET as string,
            { expiresIn: '1h' }
        );

        res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
