import { z } from "zod";

/**
 * Doctor Schedule Schema
 */
export const scheduleDaySchema = z.object({
    day_of_week: z.number().min(0).max(6),
    start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid start time"),
    end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid end time"),
    is_available: z.boolean(),
}).refine(data => {
    if (!data.is_available) return true;
    const start = data.start_time.split(':').map(Number);
    const end = data.end_time.split(':').map(Number);
    const startMinutes = start[0] * 60 + start[1];
    const endMinutes = end[0] * 60 + end[1];
    return endMinutes > startMinutes;
}, {
    message: "End time must be after start time",
    path: ["end_time"]
});

export const doctorScheduleSchema = z.object({
    schedule: z.array(scheduleDaySchema)
});

export type DoctorScheduleFormData = z.infer<typeof scheduleDaySchema>;
export type FullDoctorScheduleFormData = z.infer<typeof doctorScheduleSchema>;
