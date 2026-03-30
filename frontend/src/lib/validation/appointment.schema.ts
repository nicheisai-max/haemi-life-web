import { z } from "zod";

/**
 * Book Appointment Schema
 */
export const bookAppointmentSchema = z.object({
    doctorId: z.string().min(1, { message: "Please select a doctor" }),
    appointmentDate: z.string().min(1, { message: "Please select a date" }),
    appointmentTime: z.string().min(1, { message: "Please select a time" }),
    consultationType: z.enum(['video', 'in-person']),
    reason: z
        .string()
        .min(10, { message: "Please provide at least 10 characters describing your symptoms" })
        .max(500, { message: "Reason cannot exceed 500 characters" }),
});

export type BookAppointmentFormData = z.infer<typeof bookAppointmentSchema>;
