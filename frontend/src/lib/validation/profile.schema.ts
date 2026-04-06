import { z } from "zod";

/**
 * Profile Update Schema
 */
export const profileUpdateSchema = z.object({
    name: z.string().min(2, { message: "Name must be at least 2 characters" }),
    email: z.string().email({ message: "Please enter a valid email address" }),
    phoneNumber: z
        .string()
        .min(8, { message: "Phone number must be at least 8 digits" })
        .max(15, { message: "Phone number cannot exceed 15 digits" })
        .regex(/^[0-9+\s()-]+$/, { message: "Please enter a valid phone number" }),
    omangId: z
        .string()
        .optional(),
});

export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
