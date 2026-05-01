import { Request, Response } from 'express';
import { pool } from '../config/db';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { mapDoctorToResponse } from '../utils/doctor.mapper';
import { mapUserToResponse } from '../utils/user.mapper';
import { JoinedDoctorRow, UserEntity } from '../types/db.types';
import { auditService, SYSTEM_ANONYMOUS_ID } from '../services/audit.service';
import { decrypt } from '../utils/security';

/**
 * Decrypts the encrypted PII columns on a row joined from `users`. Mirror
 * of `UserRepository.decryptUser` but applied at the controller boundary
 * for raw SELECTs that bypass the repository. Phase 12 P0 fix: ensures
 * that listDoctors / getDoctorProfile / getDoctorPatients never emit the
 * encrypted blob into the API response.
 */
function decryptUserPii<R extends { phone_number?: string | null; id_number?: string | null }>(row: R): R {
    return {
        ...row,
        phone_number: row.phone_number ? decrypt(row.phone_number) : '',
        id_number: row.id_number ? decrypt(row.id_number) : null,
    };
}

interface UpdateDoctorProfileRequest {
    specialization?: string;
    yearsOfExperience?: number;
    bio?: string;
    consultationFee?: number;
}

interface ScheduleSlotDTO {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isAvailable?: boolean;
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
                u.id, u.name, u.email, u.phone_number, u.profile_image, u.profile_image_mime, u.initials,
                dp.specialization, dp.years_of_experience, dp.bio, dp.consultation_fee, dp.can_video_consult
            FROM users u
            JOIN doctor_profiles dp ON u.id = dp.user_id
            WHERE u.role = 'doctor' AND u.status = 'ACTIVE'
        `;

        const params: (string | number | boolean | null)[] = [];

        if (specialization) {
            params.push(String(specialization));
            query += ` AND dp.specialization = $${params.length}`;
        }

        if (search) {
            params.push(`%${String(search)}%`);
            query += ` AND u.name ILIKE $${params.length}`;
        }

        query += ' ORDER BY u.name ASC';

        const result = await pool.query<JoinedDoctorRow>(query, params);
        // P0 PII GUARD: decrypt phone/id before the mapper projects them.
        return sendResponse(res, 200, true, 'Doctors fetched', result.rows.map(row => mapDoctorToResponse(decryptUserPii(row))));
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Error fetching doctors:', { error: message });
        
        await auditService.log({
            userId: SYSTEM_ANONYMOUS_ID,
            action: 'DOCTOR_LIST_FETCH_FAILURE',
            entityType: 'DOCTOR_PROFILE',
            details: message
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
                u.id, u.name, u.email, u.phone_number, u.profile_image, u.profile_image_mime, u.initials,
                dp.specialization, dp.license_number, dp.years_of_experience,
                dp.bio, dp.consultation_fee, dp.is_verified, dp.can_video_consult
            FROM users u
            JOIN doctor_profiles dp ON u.id = dp.user_id
            WHERE u.id = $1 AND u.role = 'doctor'
        `, [id]);

        if (result.rows.length === 0) {
            return sendError(res, 404, 'Doctor not found');
        }

        // P0 PII GUARD: decrypt phone/id before the mapper projects them.
        return sendResponse(res, 200, true, 'Doctor profile fetched', mapDoctorToResponse(decryptUserPii(result.rows[0])));
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Error fetching doctor profile:', {
            error: message,
            doctorId: id
        });

        await auditService.log({
            userId: SYSTEM_ANONYMOUS_ID,
            action: 'DOCTOR_PROFILE_FETCH_FAILURE',
            entityId: String(id),
            entityType: 'DOCTOR_PROFILE',
            details: message
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
            WHERE specialization IS NOT NULL
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
    const { specialization, yearsOfExperience, bio, consultationFee } = req.body as UpdateDoctorProfileRequest;

    try {
        if (!doctorId) return sendError(res, 401, 'Unauthorized');

        // Phase 10: CTE re-joins users so the response carries the full atomic
        // profile_image / profile_image_mime pair plus identity fields the mapper requires.
        // Without the join, RETURNING * from doctor_profiles would yield neither image field.
        const result = await pool.query<JoinedDoctorRow>(`
            WITH updated AS (
                UPDATE doctor_profiles
                SET
                    specialization = COALESCE($1, specialization),
                    years_of_experience = COALESCE($2, years_of_experience),
                    bio = COALESCE($3, bio),
                    consultation_fee = COALESCE($4, consultation_fee),
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $5
                RETURNING *
            )
            SELECT
                u.id, u.name, u.email, u.phone_number, u.profile_image, u.profile_image_mime,
                u.initials, u.role, u.created_at,
                updated.specialization, updated.license_number, updated.years_of_experience,
                updated.bio, updated.consultation_fee, updated.is_verified, updated.can_video_consult
            FROM updated
            JOIN users u ON u.id = updated.user_id
        `, [specialization || null, yearsOfExperience || null, bio || null, consultationFee || null, doctorId]);

        if (result.rows.length === 0) {
            return sendError(res, 404, 'Doctor profile not found');
        }

        // P0 PII GUARD: decrypt phone/id before the mapper projects them.
        return sendResponse(res, 200, true, 'Profile updated successfully', mapDoctorToResponse(decryptUserPii(result.rows[0])));
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
                    const { dayOfWeek, startTime, endTime, isAvailable = true } = rawSlot;

                    await client.query(`
                        INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [doctorId, dayOfWeek, startTime, endTime, isAvailable]);
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
                u.id, u.name, u.phone_number, u.email, u.profile_image, u.profile_image_mime,
                u.role, u.status, u.initials,
                COUNT(a.id) as total_appointments,
                MAX(a.appointment_date) as last_visit
            FROM users u
            JOIN appointments a ON u.id = a.patient_id
            WHERE a.doctor_id = $1 AND a.status = 'completed'
            GROUP BY u.id, u.name, u.phone_number, u.email
            ORDER BY MAX(a.appointment_date) DESC
        `, [doctorId]);

        // P0 PII GUARD: decrypt phone/id before the mapper projects them.
        return sendResponse(res, 200, true, 'Patients fetched', result.rows.map(row => ({
            ...mapUserToResponse(decryptUserPii(row)),
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
