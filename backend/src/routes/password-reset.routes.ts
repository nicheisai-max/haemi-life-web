import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { randomInt } from 'crypto';

const router = Router();

// Helper function to generate cryptographically adequate 6-digit OTP
const generateOTP = (): string => {
    return randomInt(100000, 999999).toString();
};

/**
 * V3 FIX: OTP store with brute-force protection.
 */
const MAX_OTP_ATTEMPTS = 5;

interface OtpEntry {
    otp: string;
    expiresAt: number;
    identifier: string;
    attempts: number; // V3: brute-force counter
}

const otpStore: Map<string, OtpEntry> = new Map();

// Cleanup expired OTPs periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of otpStore.entries()) {
        if (now > entry.expiresAt) otpStore.delete(key);
    }
}, 5 * 60 * 1000).unref(); // Every 5 minutes (unrefed for Jest safety)

/**
 * POST /api/password-reset/request-reset
 * Request password reset — sends OTP to email/phone
 */
router.post(
    '/request-reset',
    [body('identifier').notEmpty().withMessage('Email or phone number is required')],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { identifier } = req.body;

        try {
            const isEmail = identifier.includes('@');
            const query = isEmail
                ? 'SELECT id, email, phone_number FROM users WHERE email = $1'
                : 'SELECT id, email, phone_number FROM users WHERE phone_number = $1';

            const result = await pool.query(query, [identifier]);
            const GENERIC_RESPONSE = { message: 'If the account exists, an OTP has been sent.' };

            if (result.rows.length === 0) {
                return res.status(200).json(GENERIC_RESPONSE);
            }

            const otp = generateOTP();
            const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

            // Store OTP with attempt counter initialized to 0
            otpStore.set(identifier, { otp, expiresAt, identifier, attempts: 0 });

            return res.status(200).json(GENERIC_RESPONSE);
        } catch (error: unknown) {
            console.error('Request reset error:', error);
            res.status(500).json({ message: 'Failed to process request' });
        }
    }
);

/**
 * POST /api/password-reset/verify-otp
 * Verify OTP for password reset
 */
router.post(
    '/verify-otp',
    [
        body('identifier').notEmpty().withMessage('Email or phone number is required'),
        body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { identifier, otp } = req.body;

        try {
            const storedData = otpStore.get(identifier);

            if (!storedData) {
                return res.status(400).json({ message: 'Invalid or expired OTP' });
            }

            if (storedData.attempts >= MAX_OTP_ATTEMPTS) {
                otpStore.delete(identifier);
                return res.status(429).json({
                    message: 'Too many failed attempts. Please request a new OTP.',
                });
            }

            if (Date.now() > storedData.expiresAt) {
                otpStore.delete(identifier);
                return res.status(400).json({ message: 'OTP has expired' });
            }

            if (storedData.otp !== otp) {
                storedData.attempts += 1;
                const remainingAttempts = MAX_OTP_ATTEMPTS - storedData.attempts;
                return res.status(400).json({
                    message: `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
                });
            }

            const resetToken = jwt.sign(
                { identifier },
                process.env.JWT_SECRET as string,
                { expiresIn: '30m' }
            );

            otpStore.delete(identifier);
            return res.status(200).json({ message: 'OTP verified successfully', resetToken });
        } catch (error: unknown) {
            console.error('Verify OTP error:', error);
            res.status(500).json({ message: 'Failed to verify OTP' });
        }
    }
);

/**
 * POST /api/password-reset/reset-password
 * Reset password with verified token
 */
router.post(
    '/reset-password',
    [
        body('resetToken').notEmpty().withMessage('Reset token is required'),
        body('newPassword')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters'),
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { resetToken, newPassword } = req.body;

        try {
            const decoded = jwt.verify(resetToken, process.env.JWT_SECRET as string) as { identifier: string };
            const { identifier } = decoded;

            const isEmail = identifier.includes('@');
            const query = isEmail
                ? 'SELECT id FROM users WHERE email = $1'
                : 'SELECT id FROM users WHERE phone_number = $1';

            const result = await pool.query(query, [identifier]);

            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            const userId = result.rows[0].id;
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            await pool.query(
                'UPDATE users SET password = $1, token_version = COALESCE(token_version, 0) + 1 WHERE id = $2',
                [hashedPassword, userId]
            );

            return res.status(200).json({ message: 'Password reset successfully' });
        } catch (error: unknown) {
            console.error('Reset password error:', error);
            const err = error as { name?: string };
            if (err.name === 'JsonWebTokenError') {
                return res.status(400).json({ message: 'Invalid reset token' });
            }
            if (err.name === 'TokenExpiredError') {
                return res.status(400).json({ message: 'Reset token has expired' });
            }
            res.status(500).json({ message: 'Failed to reset password' });
        }
    }
);

/**
 * POST /api/password-reset/resend-otp
 * Resend OTP for password reset
 */
router.post(
    '/resend-otp',
    [body('identifier').notEmpty().withMessage('Email or phone number is required')],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { identifier } = req.body;

        try {
            const isEmail = identifier.includes('@');
            const query = isEmail
                ? 'SELECT id, email, phone_number FROM users WHERE email = $1'
                : 'SELECT id, email, phone_number FROM users WHERE phone_number = $1';

            const result = await pool.query(query, [identifier]);
            if (result.rows.length === 0) {
                return res.status(200).json({ message: 'If the account exists, an OTP has been sent.' });
            }

            const otp = generateOTP();
            const expiresAt = Date.now() + 10 * 60 * 1000;
            otpStore.set(identifier, { otp, expiresAt, identifier, attempts: 0 });

            return res.status(200).json({ message: 'OTP resent successfully' });
        } catch (error: unknown) {
            console.error('Resend OTP error:', error);
            res.status(500).json({ message: 'Failed to resend OTP' });
        }
    }
);

export default router;
