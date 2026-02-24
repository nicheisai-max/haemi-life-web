import { Request, Response } from 'express';
import { appointmentRepository } from '../repositories/appointment.repository';
import { pool } from '../config/db';
import { io } from '../app';

// Helper to create a notification in DB and emit it in real-time
async function createAndEmitNotification(
    userId: string,
    title: string,
    description: string,
    type: 'success' | 'info' | 'warning' | 'error'
) {
    const result = await pool.query(
        `INSERT INTO notifications (user_id, title, description, type) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [userId, title, description, type]
    );
    const notification = result.rows[0];
    // Emit to the user's personal room (user joins room `user:<id>` on socket connect)
    if (io) {
        io.to(`user:${userId}`).emit('new_notification', notification);
    }
    return notification;
}

// Book a new appointment (Patient)
export const bookAppointment = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const patientId = user.id;
        const { doctor_id, appointment_date, appointment_time, consultation_type, reason } = req.body;

        // Validate that doctor exists and is verified
        const isVerified = await appointmentRepository.checkDoctorVerified(doctor_id);
        if (!isVerified) {
            return res.status(404).json({ message: 'Doctor not found or not verified' });
        }

        // --- Medical-Grade Safety Guard: Telemedicine Consent ---
        if (consultation_type === 'video') {
            // Lazy import to avoid circular dependency issues at the top level
            const { consentRepository } = await import('../repositories/consent.repository');
            const hasConsent = await consentRepository.hasConsent(patientId);
            if (!hasConsent) {
                return res.status(403).json({
                    message: 'Telemedicine consent required. Please review and sign the digital consent form before booking a video consultation.'
                });
            }
        }
        // --------------------------------------------------------

        // Check for conflicts
        const hasConflict = await appointmentRepository.checkConflict(doctor_id, appointment_date, appointment_time);
        if (hasConflict) {
            return res.status(409).json({ message: 'This time slot is already booked' });
        }

        const appointment = await appointmentRepository.create({
            patient_id: patientId,
            doctor_id,
            appointment_date,
            appointment_time,
            consultation_type,
            reason
        });

        // Fetch doctor name for notification messages
        const doctorResult = await pool.query('SELECT name FROM users WHERE id = $1', [doctor_id]);
        const doctorName = doctorResult.rows[0]?.name || 'your doctor';
        const patientName = user.name || 'A patient';

        const formattedDate = new Date(appointment_date).toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
        });
        const formattedTime = new Date(`2000-01-01T${appointment_time}`).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
        });

        // Notify patient
        await createAndEmitNotification(
            patientId,
            'Appointment Confirmed',
            `Your appointment with ${doctorName} on ${formattedDate} at ${formattedTime} has been booked successfully.`,
            'success'
        );

        // Notify doctor
        await createAndEmitNotification(
            doctor_id,
            'New Appointment Request',
            `${patientName} has booked an appointment with you on ${formattedDate} at ${formattedTime}.`,
            'info'
        );

        res.status(201).json({ message: 'Appointment booked successfully', appointment });
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

        const appointments = await appointmentRepository.findByUserId(
            userId as string,
            status as string,
            upcoming === 'true'
        );
        res.json(appointments);
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

        const appointment = await appointmentRepository.findByIdWithDetails(id as string, user.id as string);

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        res.json(appointment);
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

        const appointment = await appointmentRepository.updateStatus(id as string, user.id as string, status as string, notes as string);

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found or access denied' });
        }

        res.json({ message: 'Appointment updated successfully', appointment });
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

        const appointment = await appointmentRepository.cancel(id as string, user.id as string);

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found or access denied' });
        }

        res.json({ message: 'Appointment cancelled successfully', appointment });
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        res.status(500).json({ message: 'Error cancelling appointment' });
    }
};

// Permanently delete a past appointment (Patient only)
export const deleteAppointment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        if (user.role !== 'patient') {
            return res.status(403).json({ message: 'Only patients can permanently delete appointments' });
        }

        const deleted = await appointmentRepository.softDelete(id as string, user.id as string);

        if (!deleted) {
            return res.status(404).json({
                message: 'Appointment not found, already deleted, or cannot be deleted (only past/completed/cancelled appointments can be deleted)'
            });
        }

        res.json({ message: 'Appointment deleted successfully' });
    } catch (error) {
        console.error('Error deleting appointment:', error);
        res.status(500).json({ message: 'Error deleting appointment' });
    }
};

// Get available time slots for a doctor
export const getAvailableSlots = async (req: Request, res: Response) => {
    try {
        const { doctor_id, date } = req.query;

        if (!doctor_id || !date) {
            return res.status(400).json({ message: 'doctor_id and date are required' });
        }

        // Get day of week from date using UTC-safe local parsing
        const [year, month, day] = (date as string).split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 6 is Saturday

        // Get doctor's schedule for that day (passing integer as defined in init.sql)
        const schedule = await appointmentRepository.getDoctorSchedule(doctor_id as string, dayOfWeek);

        if (schedule.length === 0) {
            return res.json({ slots: [] });
        }

        // Get booked appointments
        const bookedTimes = await appointmentRepository.getBookedTimes(doctor_id as string, date as string);

        const slots: string[] = [];
        for (const row of schedule) {
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
