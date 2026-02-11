import { z } from "zod";

/**
 * User Preferences Schema
 */
export const preferencesSchema = z.object({
    emailNotifications: z.boolean(),
    smsNotifications: z.boolean(),
    marketingCommunications: z.boolean(),
});

export type PreferencesFormData = z.infer<typeof preferencesSchema>;
