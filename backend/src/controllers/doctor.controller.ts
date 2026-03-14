import { Request, Response } from 'express';
import { pool } from '../config/db';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';

// Get all verified doctors (Public/Patient access)
export const listDoctors = async (req: Request, res: Response) => {
    try {
        const { specialization, search } = req.query;

        let query = `
            SELECT 
                u.id, u.name, u.email, u.phone_number,
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

        const result = await pool.query(query, params);
        sendResponse(res, 200, true, 'Doctors fetched', result.rows);
    } catch (error) {
        console.error('Error fetching doctors:', error);
        sendError(res, 500, 'Error fetching doctors');
    }
};

// Get doctor profile by ID
export const getDoctorProfile = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT 
                u.id, u.name, u.email, u.phone_number,
                dp.specialization, dp.license_number, dp.years_of_experience, 
                dp.bio, dp.consultation_fee, dp.is_verified
            FROM users u
            JOIN doctor_profiles dp ON u.id = dp.user_id
            WHERE u.id = $1 AND u.role = 'doctor'
        `, [id]);

        if (result.rows.length === 0) {
            return sendError(res, 404, 'Doctor not found');
        }

        sendResponse(res, 200, true, 'Doctor profile fetched', result.rows[0]);
    } catch (error) {
        console.error('Error fetching doctor profile:', error);
        sendError(res, 500, 'Error fetching doctor profile');
    }
};

// Get list of specializations
export const getSpecializations = async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT specialization 
            FROM doctor_profiles 
            WHERE specialization IS NOT NULL AND is_verified = true
            ORDER BY specialization ASC
        `);

        sendResponse(res, 200, true, 'Specializations fetched', result.rows.map(row => row.specialization));
    } catch (error) {
        console.error('Error fetching specializations:', error);
        sendError(res, 500, 'Error fetching specializations');
    }
};

// Update doctor's own profile (Doctor only)
export const updateDoctorProfile = async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user) return sendError(res, 401, 'Unauthorized');
        const doctorId = user.id;
        const { specialization, years_of_experience, bio, consultation_fee } = req.body;

        const result = await pool.query(`
            UPDATE doctor_profiles 
            SET 
                specialization = COALESCE($1, specialization),
                years_of_experience = COALESCE($2, years_of_experience),
                bio = COALESCE($3, bio),
                consultation_fee = COALESCE($4, consultation_fee),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $5
            RETURNING *
        `, [specialization, years_of_experience, bio, consultation_fee, doctorId]);

        if (result.rows.length === 0) {
            return sendError(res, 404, 'Doctor profile not found');
        }

        sendResponse(res, 200, true, 'Profile updated successfully', result.rows[0]);
    } catch (error) {
        logger.error('Error updating doctor profile:', error);
        return sendError(res, 500, 'Error updating profile');
    }
};

// Get doctor's schedule
export const getDoctorSchedule = async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user) return sendError(res, 401, 'Unauthorized');
        const doctorId = user.id;

        const result = await pool.query(`
            SELECT * FROM doctor_schedules 
            WHERE doctor_id = $1 
            ORDER BY day_of_week, start_time
        `, [doctorId]);

        sendResponse(res, 200, true, 'Schedule fetched', result.rows);
    } catch (error) {
        console.error('Error fetching schedule:', error);
        sendError(res, 500, 'Error fetching schedule');
    }
};

// Update doctor's schedule
export const updateDoctorSchedule = async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user) return sendError(res, 401, 'Unauthorized');
        const doctorId = user.id;
        const { schedule } = req.body; // Array of { day_of_week, start_time, end_time, is_available }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Delete existing schedule
            await client.query('DELETE FROM doctor_schedules WHERE doctor_id = $1', [doctorId]);

            // Insert new schedule
            for (const slot of schedule) {
                await client.query(`
                    INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available)
                    VALUES ($1, $2, $3, $4, $5)
                `, [doctorId, slot.day_of_week, slot.start_time, slot.end_time, slot.is_available]);
            }

            await client.query('COMMIT');
            sendResponse(res, 200, true, 'Schedule updated successfully');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error updating schedule:', error);
        sendError(res, 500, 'Error updating schedule');
    }
};

// Get doctor's patient list
export const getDoctorPatients = async (req: Request, res: Response) => {
    try {
        const user = req.user;
        if (!user) return sendError(res, 401, 'Unauthorized');
        const doctorId = user.id;

        const result = await pool.query(`
            SELECT DISTINCT 
                u.id, u.name, u.phone_number, u.email,
                COUNT(a.id) as total_appointments,
                MAX(a.appointment_date) as last_visit
            FROM users u
            JOIN appointments a ON u.id = a.patient_id
            WHERE a.doctor_id = $1 AND a.status = 'completed'
            GROUP BY u.id, u.name, u.phone_number, u.email
            ORDER BY MAX(a.appointment_date) DESC
        `, [doctorId]);

        sendResponse(res, 200, true, 'Patients fetched', result.rows);
    } catch (error) {
        console.error('Error fetching patients:', error);
        sendError(res, 500, 'Error fetching patients');
    }
};
