import { z } from "zod";

/**
 * Telemedicine Consent Schema
 */
export const telemedicineConsentSchema = z.object({
    accepted: z.boolean().refine(val => val === true, {
        message: "You must accept the terms to continue"
    }),
});

export type TelemedicineConsentFormData = z.infer<typeof telemedicineConsentSchema>;
