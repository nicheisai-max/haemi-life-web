import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import demoConfig from '../config/demo.config';

const router = Router();

// Helper function to generate 6-digit OTP
const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTPs temporarily (in production, use Redis)
const otpStore: Map<string, { otp: string; expiresAt: number; identifier: string }> = new Map();

/**
 * POST /api/auth/request-reset
 * Request password reset - sends OTP to email/phone
 */
router.post(
    '/request-reset',
    [
        body('identifier').notEmpty().withMessage('Email or phone number is required'),
    ],
    async (req: Request, res: Response) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { identifier } = req.body;

        try {
            // Check if user exists
            const isEmail = identifier.includes('@');
            const query = isEmail
                ? 'SELECT id, email, phone_number FROM users WHERE email = $1'
                : 'SELECT id, email, phone_number FROM users WHERE phone_number = $1';

            const result = await pool.query(query, [identifier]);

            if (result.rows.length === 0) {
                // Don't reveal if user exists for security
                return res.status(200).json({
                    message: 'If the account exists, an OTP has been sent.',
                });
            }

            const user = result.rows[0];
            const otp = generateOTP();
            const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

            // Store OTP
            otpStore.set(identifier, { otp, expiresAt, identifier });

            // Demo mode: log OTP to console, don't send email/SMS
            if (demoConfig.isDemoMode()) {
                demoConfig.log(`OTP for ${identifier}`, otp);
                return res.status(200).json({
                    message: 'OTP sent successfully',
                    dev_otp: otp, // Always show in demo mode
                });
            }

            // Production: Send OTP via email/SMS
            console.log(`[OTP] ${identifier}: ${otp}`);

            // TODO: Integrate with email/SMS service
            // await sendOTP(user.email || user.phone_number, otp);

            res.status(200).json({
                message: 'OTP sent successfully',
                // For development only - remove in production
                dev_otp: process.env.NODE_ENV === 'development' ? otp : undefined,
            });
        } catch (error) {
            console.error('Request reset error:', error);
            res.status(500).json({ message: 'Failed to process request' });
        }
    }
);

/**
 * POST /api/auth/verify-otp
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
            // Demo mode: Accept demo OTP without validation
            if (demoConfig.isDemoMode() && otp === demoConfig.DEMO_OTP) {
                demoConfig.log('Demo OTP accepted', identifier);
                const resetToken = jwt.sign(
                    { identifier },
                    process.env.JWT_SECRET!,
                    { expiresIn: '30m' }
                );
                return res.status(200).json({
                    message: 'OTP verified successfully',
                    resetToken,
                });
            }

            const storedData = otpStore.get(identifier);

            if (!storedData) {
                return res.status(400).json({ message: 'Invalid or expired OTP' });
            }

            if (Date.now() > storedData.expiresAt) {
                otpStore.delete(identifier);
                return res.status(400).json({ message: 'OTP has expired' });
            }

            if (storedData.otp !== otp) {
                return res.status(400).json({ message: 'Invalid OTP' });
            }

            // Generate reset token (valid for 30 minutes)
            const resetToken = jwt.sign(
                { identifier },
                process.env.JWT_SECRET!,
                { expiresIn: '30m' }
            );

            // Keep OTP for password reset step
            res.status(200).json({
                message: 'OTP verified successfully',
                resetToken,
            });
        } catch (error) {
            console.error('Verify OTP error:', error);
            res.status(500).json({ message: 'Failed to verify OTP' });
        }
    }
);

/**
 * POST /api/auth/reset-password
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
            // Verify reset token
            const decoded = jwt.verify(
                resetToken,
                process.env.JWT_SECRET!
            ) as { identifier: string };

            const { identifier } = decoded;

            // Check if user exists
            const isEmail = identifier.includes('@');
            const query = isEmail
                ? 'SELECT id FROM users WHERE email = $1'
                : 'SELECT id FROM users WHERE phone_number = $1';

            const result = await pool.query(query, [identifier]);

            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            const userId = result.rows[0].id;

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password
            await pool.query('UPDATE users SET password = $1 WHERE id = $2', [
                hashedPassword,
                userId,
            ]);

            // Clear OTP
            otpStore.delete(identifier);

            res.status(200).json({
                message: 'Password reset successfully',
            });
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
 * POST /api/auth/resend-otp
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
            // Check if user exists
            const isEmail = identifier.includes('@');
            const query = isEmail
                ? 'SELECT id, email, phone_number FROM users WHERE email = $1'
                : 'SELECT id, email, phone_number FROM users WHERE phone_number = $1';

            const result = await pool.query(query, [identifier]);

            if (result.rows.length === 0) {
                return res.status(200).json({
                    message: 'If the account exists, an OTP has been sent.',
                });
            }

            const otp = generateOTP();
            const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

            // Update OTP
            otpStore.set(identifier, { otp, expiresAt, identifier });

            // Demo mode: log OTP
            if (demoConfig.isDemoMode()) {
                demoConfig.log(`OTP resent for ${identifier}`, otp);
                return res.status(200).json({
                    message: 'OTP resent successfully',
                    dev_otp: otp,
                });
            }

            console.log(`[OTP RESEND] ${identifier}: ${otp}`);

            // TODO: Send OTP via email/SMS

            res.status(200).json({
                message: 'OTP resent successfully',
                dev_otp: process.env.NODE_ENV === 'development' ? otp : undefined,
            });
        } catch (error) {
            console.error('Resend OTP error:', error);
            res.status(500).json({ message: 'Failed to resend OTP' });
        }
    }
);

export default router;
