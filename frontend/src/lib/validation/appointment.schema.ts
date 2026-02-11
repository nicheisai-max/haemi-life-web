import { z } from "zod";

/**
 * Book Appointment Schema
 */
export const bookAppointmentSchema = z.object({
    doctor_id: z.coerce.number().min(1, { message: "Please select a doctor" }),
    appointment_date: z.string().min(1, { message: "Please select a date" }),
    appointment_time: z.string().min(1, { message: "Please select a time" }),
    reason: z
        .string()
        .min(10, { message: "Please provide at least 10 characters describing your symptoms" })
        .max(500, { message: "Reason cannot exceed 500 characters" }),
});

export type BookAppointmentFormData = z.infer<typeof bookAppointmentSchema>;
