import { z } from "zod";

/**
 * Telemedicine Consent Schema
 */
export const telemedicineConsentSchema = z.object({
    accepted: z.boolean().refine(val => val === true, {
        message: "You must accept the terms to continue"
    }),
    signature: z.string().min(1, { message: "Signature is required" }),
});

export type TelemedicineConsentFormData = z.infer<typeof telemedicineConsentSchema>;
