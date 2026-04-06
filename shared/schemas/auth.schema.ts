import { z } from 'zod';
import { UserRoleSchema } from './observability.schema';

export const LoginRequestSchema = z.object({
    identifier: z.string().min(1, 'Email or phone is required'),
    password: z.string().min(1, 'Password is required'),
});

export const SignupRequestSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    phoneNumber: z.string().min(1, 'Phone number is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: UserRoleSchema,
    idNumber: z.string().optional(),
});

export const AuthResponseSchema = z.object({
    token: z.string(),
    refreshToken: z.string(),
    user: z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        role: UserRoleSchema,
        name: z.string(),
        status: z.string(),
        initials: z.string().optional(),
        profileImage: z.string().nullable().optional(),
    }),
    serverTime: z.string().optional(),
    sessionTimeout: z.number().optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type SignupRequest = z.infer<typeof SignupRequestSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
