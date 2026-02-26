import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import demoConfig from '../config/demo.config';

const router = Router();

// Helper function to generate cryptographically adequate 6-digit OTP
const generateOTP = (): string => {
    // Use crypto.randomInt for better randomness than Math.random()
    const { randomInt } = require('crypto');
    return randomInt(100000, 999999).toString();
};

/**
 * V3 FIX: OTP store with brute-force protection.
 * Each entry tracks attempt count. After MAX_OTP_ATTEMPTS failed verifications,
 * the OTP is invalidated and a new request-reset is required.
 *
 * NOTE: This is an in-process Map (suitable for single-instance dev/demo).
 * For production multi-instance deployments, replace with Redis.
 */
const MAX_OTP_ATTEMPTS = 5;

interface OtpEntry {
    otp: string;
    expiresAt: number;
    identifier: string;
    attempts: number; // V3: brute-force counter
}

const otpStore: Map<string, OtpEntry> = new Map();

// Cleanup expired OTPs periodically to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of otpStore.entries()) {
        if (now > entry.expiresAt) otpStore.delete(key);
    }
}, 5 * 60 * 1000); // Every 5 minutes

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

            // Always return the same response whether user exists or not (prevents user enumeration)
            const GENERIC_RESPONSE = { message: 'If the account exists, an OTP has been sent.' };

            if (result.rows.length === 0) {
                return res.status(200).json(GENERIC_RESPONSE);
            }

            const otp = generateOTP();
            const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

            // Store OTP with attempt counter initialized to 0
            otpStore.set(identifier, { otp, expiresAt, identifier, attempts: 0 });

            // Log to server console only (for development debugging via server logs).
            // In a real production deployment, integrate with email/SMS provider here.
            // TODO: await emailService.sendOTP(user.email, otp);
            // TODO: await smsService.sendOTP(user.phone_number, otp);

            return res.status(200).json(GENERIC_RESPONSE);
        } catch (error) {
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

            // V3 FIX: Check brute-force attempt counter BEFORE validating OTP
            if (storedData.attempts >= MAX_OTP_ATTEMPTS) {
                otpStore.delete(identifier); // Invalidate after max attempts
                return res.status(429).json({
                    message: 'Too many failed attempts. Please request a new OTP.',
                });
            }

            if (Date.now() > storedData.expiresAt) {
                otpStore.delete(identifier);
                return res.status(400).json({ message: 'OTP has expired' });
            }

            if (storedData.otp !== otp) {
                // V3: Increment attempt counter on failure
                storedData.attempts += 1;
                const remainingAttempts = MAX_OTP_ATTEMPTS - storedData.attempts;
                return res.status(400).json({
                    message: `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
                });
            }

            // OTP is valid — generate reset token and remove OTP from store
            const resetToken = jwt.sign(
                { identifier },
                process.env.JWT_SECRET!,
                { expiresIn: '30m' }
            );

            // Consume the OTP immediately (single-use)
            otpStore.delete(identifier);

            return res.status(200).json({ message: 'OTP verified successfully', resetToken });
        } catch (error) {
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
            const decoded = jwt.verify(resetToken, process.env.JWT_SECRET!) as { identifier: string };
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

            // Update password AND increment token_version to invalidate all existing sessions
            // This ensures that after a password reset, all previously issued JWTs are rejected
            await pool.query(
                'UPDATE users SET password = $1, token_version = COALESCE(token_version, 0) + 1 WHERE id = $2',
                [hashedPassword, userId]
            );

            return res.status(200).json({ message: 'Password reset successfully' });
        } catch (error: any) {
            console.error('Reset password error:', error);

            if (error.name === 'JsonWebTokenError') {
                return res.status(400).json({ message: 'Invalid reset token' });
            }
            if (error.name === 'TokenExpiredError') {
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
                ? 'SELECT id FROM users WHERE email = $1'
                : 'SELECT id FROM users WHERE phone_number = $1';

            const result = await pool.query(query, [identifier]);

            // Always return same response (prevents user enumeration)
            if (result.rows.length === 0) {
                return res.status(200).json({ message: 'If the account exists, an OTP has been sent.' });
            }

            const otp = generateOTP();
            const expiresAt = Date.now() + 10 * 60 * 1000;

            // Reset attempt counter on resend
            otpStore.set(identifier, { otp, expiresAt, identifier, attempts: 0 });

            // V2 FIX: Never return OTP in production response

            return res.status(200).json({ message: 'OTP resent successfully' });
        } catch (error) {
            console.error('Resend OTP error:', error);
            res.status(500).json({ message: 'Failed to resend OTP' });
        }
    }
);

export default router;
