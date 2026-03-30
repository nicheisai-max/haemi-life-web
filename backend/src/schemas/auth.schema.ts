import { z } from 'zod';

export const loginSchema = z.object({
    body: z.object({
        identifier: z.string().min(1, { message: 'Email or Phone number is required' }),
        password: z.string().min(1, { message: 'Password is required' }),
    }),
});

/**
 * V4 FIX: 'admin' is removed from the self-registration role enum.
 *
 * Only 'patient', 'doctor', and 'pharmacist' can self-register via the public API.
 * Admin accounts must be created via the admin panel or database seeding only.
 * Allowing 'admin' in the signup schema was a critical privilege escalation vulnerability —
 * any attacker could POST { role: "admin" } and gain full admin access.
 *
 * Default role is 'patient' if not specified.
 */
export const signupSchema = z.object({
    body: z.object({
        name: z.string().min(2, { message: 'Name must be at least 2 characters long' }),
        email: z.string().email({ message: 'Please enter a valid email address' }),
        password: z.string().min(6, { message: 'Password must be at least 6 characters long' }),
        phoneNumber: z.string().min(8, { message: 'Valid phone number is required' }),
        // SECURITY: 'admin' is intentionally excluded from self-registration
        role: z.enum(['patient', 'doctor', 'pharmacist']).default('patient'),
        idNumber: z.string().optional(),
    }),
});
