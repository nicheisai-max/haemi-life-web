import { Request, Response } from 'express';
import { pool } from '../config/db';

// Book a new appointment (Patient)
export const bookAppointment = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const patientId = user.id;
        const { doctor_id, appointment_date, appointment_time, consultation_type, reason } = req.body;

        // Validate that doctor exists and is verified
        const doctorCheck = await pool.query(`
            SELECT u.id FROM users u
            JOIN doctor_profiles dp ON u.id = dp.user_id
            WHERE u.id = $1 AND dp.is_verified = true
        `, [doctor_id]);

        if (doctorCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Doctor not found or not verified' });
        }

        // Check for conflicts
        const conflictCheck = await pool.query(`
            SELECT id FROM appointments
            WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3 AND status != 'cancelled'
        `, [doctor_id, appointment_date, appointment_time]);

        if (conflictCheck.rows.length > 0) {
            return res.status(409).json({ message: 'This time slot is already booked' });
        }

        const result = await pool.query(`
            INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, consultation_type, reason, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
            RETURNING *
        `, [patientId, doctor_id, appointment_date, appointment_time, consultation_type, reason]);

        res.status(201).json({ message: 'Appointment booked successfully', appointment: result.rows[0] });
    } catch (error) {
        console.error('Error booking appointment:', error);
        res.status(500).json({ message: 'Error booking appointment' });
    }
};

// Get user's appointments
export const getMyAppointments = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const userId = user.id;
        const { status, upcoming } = req.query;

        let query = `
            SELECT 
                a.*,
                CASE 
                    WHEN a.patient_id = $1 THEN u_doctor.name
                    ELSE u_patient.name
                END as other_party_name,
                CASE 
                    WHEN a.patient_id = $1 THEN 'patient'
                    ELSE 'doctor'
                END as user_role
            FROM appointments a
            LEFT JOIN users u_doctor ON a.doctor_id = u_doctor.id
            LEFT JOIN users u_patient ON a.patient_id = u_patient.id
            WHERE (a.patient_id = $1 OR a.doctor_id = $1)
        `;

        const params: any[] = [userId];

        if (status) {
            params.push(status);
            query += ` AND a.status = $${params.length}`;
        }

        if (upcoming === 'true') {
            query += ` AND a.appointment_date >= CURRENT_DATE`;
        }

        query += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ message: 'Error fetching appointments' });
    }
};

// Get appointment by ID
export const getAppointmentById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        const result = await pool.query(`
            SELECT 
                a.*,
                u_doctor.name as doctor_name,
                u_patient.name as patient_name,
                u_patient.phone_number as patient_phone,
                dp.specialization
            FROM appointments a
            JOIN users u_doctor ON a.doctor_id = u_doctor.id
            JOIN users u_patient ON a.patient_id = u_patient.id
            LEFT JOIN doctor_profiles dp ON a.doctor_id = dp.user_id
            WHERE a.id = $1 AND (a.patient_id = $2 OR a.doctor_id = $2)
        `, [id, user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching appointment:', error);
        res.status(500).json({ message: 'Error fetching appointment' });
    }
};

// Update appointment status (Doctor)
export const updateAppointmentStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        const user = (req as any).user;

        // Verify doctor owns this appointment
        const apptCheck = await pool.query(
            'SELECT id FROM appointments WHERE id = $1 AND doctor_id = $2',
            [id, user.id]
        );

        if (apptCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Appointment not found or access denied' });
        }

        const result = await pool.query(`
            UPDATE appointments
            SET status = $1, notes = COALESCE($2, notes), updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
        `, [status, notes, id]);

        res.json({ message: 'Appointment updated successfully', appointment: result.rows[0] });
    } catch (error) {
        console.error('Error updating appointment:', error);
        res.status(500).json({ message: 'Error updating appointment' });
    }
};

// Cancel appointment
export const cancelAppointment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        // Verify user owns this appointment (as patient or doctor)
        const apptCheck = await pool.query(
            'SELECT id FROM appointments WHERE id = $1 AND (patient_id = $2 OR doctor_id = $2)',
            [id, user.id]
        );

        if (apptCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Appointment not found or access denied' });
        }

        const result = await pool.query(`
            UPDATE appointments
            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `, [id]);

        res.json({ message: 'Appointment cancelled successfully', appointment: result.rows[0] });
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        res.status(500).json({ message: 'Error cancelling appointment' });
    }
};

// Get available time slots for a doctor
export const getAvailableSlots = async (req: Request, res: Response) => {
    try {
        const { doctor_id, date } = req.query;

        if (!doctor_id || !date) {
            return res.status(400).json({ message: 'doctor_id and date are required' });
        }

        // Get day of week from date
        const dateObj = new Date(date as string);
        const dayOfWeekIndex = dateObj.getDay();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayOfWeek = days[dayOfWeekIndex]; // Convert 0-6 to 'sunday'-'saturday'

        // Get doctor's schedule for that day (using ILIKE for case-insensitive match)
        const scheduleResult = await pool.query(`
            SELECT start_time, end_time FROM doctor_schedules
            WHERE doctor_id = $1 AND day_of_week ILIKE $2 AND is_available = true
        `, [doctor_id, dayOfWeek]);

        if (scheduleResult.rows.length === 0) {
            return res.json({ slots: [] });
        }

        // Get booked appointments
        const bookedResult = await pool.query(`
            SELECT appointment_time FROM appointments
            WHERE doctor_id = $1 AND appointment_date = $2 AND status != 'cancelled'
        `, [doctor_id, date]);

        const bookedTimes = bookedResult.rows.map(row => {
            // Ensure time is in HH:mm format for comparison
            const time = row.appointment_time;
            return typeof time === 'string' ? time.slice(0, 5) : time;
        });

        const slots: string[] = [];
        for (const row of scheduleResult.rows) {
            let current = new Date(`2000-01-01T${row.start_time}`);
            const end = new Date(`2000-01-01T${row.end_time}`);

            while (current < end) {
                const timeStr = current.toTimeString().slice(0, 5);
                if (!bookedTimes.includes(timeStr)) {
                    slots.push(timeStr);
                }
                current.setMinutes(current.getMinutes() + 30); // 30-min slots
            }
        }

        res.json({ date, slots });
    } catch (error) {
        console.error('Error fetching available slots:', error);
        res.status(500).json({ message: 'Error fetching available slots' });
    }
};
