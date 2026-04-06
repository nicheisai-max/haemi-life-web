import { z } from "zod";

/**
 * Doctor Schedule Schema
 */
export const scheduleDaySchema = z.object({
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid start time"),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid end time"),
    isAvailable: z.boolean(),
}).refine(data => {
    if (!data.isAvailable) return true;
    const start = data.startTime.split(':').map(Number);
    const end = data.endTime.split(':').map(Number);
    const startMinutes = start[0] * 60 + start[1];
    const endMinutes = end[0] * 60 + end[1];
    return endMinutes > startMinutes;
}, {
    message: "End time must be after start time",
    path: ["endTime"]
});

export const doctorScheduleSchema = z.object({
    schedule: z.array(scheduleDaySchema)
});

export type DoctorScheduleFormData = z.infer<typeof scheduleDaySchema>;
export type FullDoctorScheduleFormData = z.infer<typeof doctorScheduleSchema>;
