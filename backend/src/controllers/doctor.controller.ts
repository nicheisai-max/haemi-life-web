import { Request, Response } from 'express';
import { pool } from '../config/db';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { mapDoctorToResponse } from '../utils/doctor.mapper';
import { mapUserToResponse } from '../utils/user.mapper';
import { JoinedDoctorRow, UserEntity } from '../types/db.types';

interface UpdateDoctorProfileRequest {
    specialization?: string;
    years_of_experience?: number;
    bio?: string;
    consultation_fee?: number;
}

interface ScheduleSlotDTO {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isAvailable?: boolean;
    // legacy support
    day_of_week?: number;
    start_time?: string;
    end_time?: string;
    is_available?: boolean;
}

interface UpdateDoctorScheduleRequest {
    schedule: ScheduleSlotDTO[];
}

// Get all verified doctors (Public/Patient access)
export const listDoctors = async (req: Request, res: Response) => {
    const { specialization, search } = req.query;

    try {
        let query = `
            SELECT 
                u.id, u.name, u.email, u.phone_number, u.profile_image,
                dp.specialization, dp.years_of_experience, dp.bio, dp.consultation_fee
            FROM users u
            JOIN doctor_profiles dp ON u.id = dp.user_id
            WHERE u.role = 'doctor' AND dp.is_verified = true AND u.status = 'ACTIVE'
        `;

        const params: (string | number | boolean | null)[] = [];

        if (specialization) {
            params.push(specialization as string);
            query += ` AND dp.specialization = $${params.length}`;
        }

        if (search) {
            params.push(`%${search as string}%`);
            query += ` AND u.name ILIKE $${params.length}`;
        }

        query += ' ORDER BY u.name ASC';

        const result = await pool.query<JoinedDoctorRow>(query, params);
        return sendResponse(res, 200, true, 'Doctors fetched', result.rows.map(mapDoctorToResponse));
    } catch (error: unknown) {
        logger.error('Error fetching doctors:', {
            error: error instanceof Error ? error.message : String(error)
        });
        return sendError(res, 500, 'Error fetching doctors');
    }
};

// Get doctor profile by ID
export const getDoctorProfile = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const result = await pool.query<JoinedDoctorRow>(`
            SELECT 
                u.id, u.name, u.email, u.phone_number, u.profile_image,
                dp.specialization, dp.license_number, dp.years_of_experience, 
                dp.bio, dp.consultation_fee, dp.is_verified
            FROM users u
            JOIN doctor_profiles dp ON u.id = dp.user_id
            WHERE u.id = $1 AND u.role = 'doctor'
        `, [id]);

        if (result.rows.length === 0) {
            return sendError(res, 404, 'Doctor not found');
        }

        return sendResponse(res, 200, true, 'Doctor profile fetched', mapDoctorToResponse(result.rows[0]));
    } catch (error: unknown) {
        logger.error('Error fetching doctor profile:', {
            error: error instanceof Error ? error.message : String(error),
            doctorId: id
        });
        return sendError(res, 500, 'Error fetching doctor profile');
    }
};

// Get list of specializations
export const getSpecializations = async (req: Request, res: Response) => {
    try {
        const result = await pool.query<{ specialization: string }>(`
            SELECT DISTINCT specialization 
            FROM doctor_profiles 
            WHERE specialization IS NOT NULL AND is_verified = true
            ORDER BY specialization ASC
        `);

        return sendResponse(res, 200, true, 'Specializations fetched', result.rows.map(row => row.specialization));
    } catch (error: unknown) {
        logger.error('Error fetching specializations:', {
            error: error instanceof Error ? error.message : String(error)
        });
        return sendError(res, 500, 'Error fetching specializations');
    }
};

// Update doctor's own profile (Doctor only)
export const updateDoctorProfile = async (req: Request, res: Response) => {
    const doctorId = req.user?.id;
    const { specialization, years_of_experience, bio, consultation_fee } = req.body as UpdateDoctorProfileRequest;

    try {
        if (!doctorId) return sendError(res, 401, 'Unauthorized');

        const result = await pool.query<JoinedDoctorRow>(`
            UPDATE doctor_profiles 
            SET 
                specialization = COALESCE($1, specialization),
                years_of_experience = COALESCE($2, years_of_experience),
                bio = COALESCE($3, bio),
                consultation_fee = COALESCE($4, consultation_fee),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $5
            RETURNING *
        `, [specialization || null, years_of_experience || null, bio || null, consultation_fee || null, doctorId]);

        if (result.rows.length === 0) {
            return sendError(res, 404, 'Doctor profile not found');
        }

        return sendResponse(res, 200, true, 'Profile updated successfully', result.rows[0]);
    } catch (error: unknown) {
        logger.error('Error updating doctor profile:', {
            error: error instanceof Error ? error.message : String(error),
            doctorId
        });
        return sendError(res, 500, 'Error updating profile');
    }
};

// Get doctor's schedule
export const getDoctorSchedule = async (req: Request, res: Response) => {
    const doctorId = req.user?.id;

    try {
        if (!doctorId) return sendError(res, 401, 'Unauthorized');

        const result = await pool.query<{
            id: number;
            doctor_id: string;
            day_of_week: number;
            start_time: string;
            end_time: string;
            is_available: boolean;
            created_at: Date;
        }>(`
            SELECT * FROM doctor_schedules 
            WHERE doctor_id = $1 
            ORDER BY day_of_week, start_time
        `, [doctorId]);

        const mapped = result.rows.map(row => ({
            id: row.id,
            doctorId: row.doctor_id,
            dayOfWeek: row.day_of_week,
            startTime: row.start_time,
            endTime: row.end_time,
            isAvailable: row.is_available,
            createdAt: row.created_at
        }));

        return sendResponse(res, 200, true, 'Schedule fetched', mapped);

    } catch (error: unknown) {
        logger.error('Error fetching schedule:', {
            error: error instanceof Error ? error.message : String(error),
            doctorId
        });
        return sendError(res, 500, 'Error fetching schedule');
    }
};

// Update doctor's schedule
export const updateDoctorSchedule = async (req: Request, res: Response) => {
    const doctorId = req.user?.id;
    const { schedule } = req.body as UpdateDoctorScheduleRequest;

    try {
        if (!doctorId) return sendError(res, 401, 'Unauthorized');

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Delete existing schedule
            await client.query('DELETE FROM doctor_schedules WHERE doctor_id = $1', [doctorId]);

            // Insert new schedule with explicit mapping (CamelCase -> Snake_case)
            if (schedule && Array.isArray(schedule)) {
                for (const rawSlot of schedule) {
                    const day_of_week = rawSlot.dayOfWeek !== undefined ? rawSlot.dayOfWeek : rawSlot.day_of_week;
                    const start_time = rawSlot.startTime || rawSlot.start_time;
                    const end_time = rawSlot.endTime || rawSlot.end_time;
                    const is_available = rawSlot.isAvailable !== undefined ? rawSlot.isAvailable : (rawSlot.is_available !== undefined ? rawSlot.is_available : true);

                    await client.query(`
                        INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [doctorId, day_of_week, start_time, end_time, is_available]);
                }
            }

            await client.query('COMMIT');
            return sendResponse(res, 200, true, 'Schedule updated successfully');
        } catch (error: unknown) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error: unknown) {
        logger.error('Error updating schedule:', {
            error: error instanceof Error ? error.message : String(error),
            doctorId
        });
        return sendError(res, 500, 'Error updating schedule');
    }
};

// Get doctor's patient list
export const getDoctorPatients = async (req: Request, res: Response) => {
    const doctorId = req.user?.id;

    try {
        if (!doctorId) return sendError(res, 401, 'Unauthorized');

        const result = await pool.query<UserEntity & { total_appointments: string, last_visit: Date }>(`
            SELECT DISTINCT 
                u.id, u.name, u.phone_number, u.email, u.profile_image, u.role, u.status, u.initials,
                COUNT(a.id) as total_appointments,
                MAX(a.appointment_date) as last_visit
            FROM users u
            JOIN appointments a ON u.id = a.patient_id
            WHERE a.doctor_id = $1 AND a.status = 'completed'
            GROUP BY u.id, u.name, u.phone_number, u.email
            ORDER BY MAX(a.appointment_date) DESC
        `, [doctorId]);

        return sendResponse(res, 200, true, 'Patients fetched', result.rows.map(row => ({
            ...mapUserToResponse(row),
            totalAppointments: Number(row.total_appointments),
            lastVisit: row.last_visit
        })));

    } catch (error: unknown) {
        logger.error('Error fetching patients:', {
            error: error instanceof Error ? error.message : String(error),
            doctorId
        });
        return sendError(res, 500, 'Error fetching patients');
    }
};
