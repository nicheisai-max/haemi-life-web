import { z } from 'zod';

export const loginSchema = z.object({
    body: z.object({
        identifier: z.string().min(1, { message: "Email or Phone number is required" }),
        password: z.string().min(1, { message: "Password is required" }),
    }),
});

export const signupSchema = z.object({
    body: z.object({
        name: z.string().min(2, { message: "Name must be at least 2 characters long" }),
        email: z.string().email({ message: "Please enter a valid email address" }),
        password: z.string().min(6, { message: "Password must be at least 6 characters long" }),
        phone_number: z.string().min(8, { message: "Valid phone number is required" }),
        role: z.enum(['patient', 'doctor', 'pharmacist', 'admin']).optional(),
        id_number: z.string().optional(),
    }),
});
