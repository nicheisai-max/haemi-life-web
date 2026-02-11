import { z } from "zod";

/**
 * Login Schema
 * Validates email or phone number + password
 */
export const loginSchema = z.object({
    emailOrPhone: z
        .string()
        .min(1, { message: "Email or phone number is required" })
        .refine((value) => {
            // Check if it's a valid email or phone number
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const phoneRegex = /^[0-9]{8,15}$/;
            return emailRegex.test(value) || phoneRegex.test(value);
        }, {
            message: "Please enter a valid email or phone number",
        }),
    password: z
        .string()
        .min(6, { message: "Password must be at least 6 characters" }),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Signup Schema
 * Comprehensive registration with email, phone, Omang ID, etc.
 */
export const signupSchema = z.object({
    name: z.string().min(2, { message: "Name must be at least 2 characters" }),
    email: z.string().email({ message: "Please enter a valid email address" }),
    phone_number: z
        .string()
        .min(8, { message: "Phone number must be at least 8 digits" })
        .max(15, { message: "Phone number cannot exceed 15 digits" })
        .regex(/^[0-9+\s()-]+$/, { message: "Please enter a valid phone number" }),
    omang_id: z
        .string()
        .optional()
        .refine((value) => !value || value.length >= 9, {
            message: "Omang ID must be at least 9 characters if provided",
        }),
    password: z
        .string()
        .min(6, { message: "Password must be at least 6 characters" }),
    confirmPassword: z
        .string()
        .min(6, { message: "Please confirm your password" }),
    role: z.enum(["patient", "doctor", "pharmacist"], {
        message: "Please select a valid role",
    }),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

export type SignupFormData = z.infer<typeof signupSchema>;

/**
 * Forgot Password Schema
 */
export const forgotPasswordSchema = z.object({
    email: z.string().email({ message: "Please enter a valid email address" }),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/**
 * Change Password Schema
 */
export const changePasswordSchema = z.object({
    current_password: z
        .string()
        .min(1, { message: "Current password is required" }),
    new_password: z
        .string()
        .min(6, { message: "New password must be at least 6 characters" }),
    confirmPassword: z
        .string()
        .min(6, { message: "Please confirm your new password" }),
}).refine((data) => data.new_password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
