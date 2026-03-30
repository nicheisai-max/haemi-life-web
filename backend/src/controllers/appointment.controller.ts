import { Request, Response } from 'express';
import { appointmentRepository } from '../repositories/appointment.repository';
import { pool } from '../config/db';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';
import { notificationService } from '../services/notification.service';
import { mapAppointmentToResponse } from '../utils/clinical.mapper';

interface BookAppointmentRequest {
    doctorId: string;
    appointmentDate: string;
    appointmentTime: string;
    consultationType: 'in-person' | 'video';
    reason: string;
}

interface UpdateAppointmentRequest {
    status: string;
    notes?: string;
}

// Book a new appointment (Patient)
export const bookAppointment = async (req: Request, res: Response) => {
    const { doctorId, appointmentDate, appointmentTime, consultationType, reason } = req.body as BookAppointmentRequest;
    const user = req.user;

    try {
        if (!user) return sendError(res, 401, 'Unauthorized');
        const patientId = user.id;

        // Validate that doctor exists and is verified
        const isVerified = await appointmentRepository.checkDoctorVerified(doctorId);
        if (!isVerified) {
            return sendError(res, 404, 'Doctor not found or not verified');
        }

        // --- Medical-Grade Safety Guard: Telemedicine Consent ---
        if (consultationType === 'video') {
            // Lazy import to avoid circular dependency issues at the top level
            const { consentRepository } = await import('../repositories/consent.repository');
            const hasConsent = await consentRepository.hasConsent(patientId);
            if (!hasConsent) {
                return sendError(res, 403, 'Telemedicine consent required. Please review and sign the digital consent form before booking a video consultation.');
            }
        }
        // --------------------------------------------------------

        // Check for conflicts
        const hasConflict = await appointmentRepository.checkConflict(doctorId, appointmentDate, appointmentTime);
        if (hasConflict) {
            return sendError(res, 409, 'This time slot is already booked');
        }

        const appointment = await appointmentRepository.create({
            patient_id: patientId,
            doctor_id: doctorId,
            appointment_date: appointmentDate,
            appointment_time: appointmentTime,
            consultation_type: consultationType,
            reason
        });

        // Fetch doctor name for notification messages
        const doctorResult = await pool.query<{ name: string }>('SELECT name FROM users WHERE id = $1', [doctorId]);
        const doctorName = doctorResult.rows[0]?.name || 'your doctor';
        const patientName = user.name || 'A patient';

        const formattedDate = new Date(appointmentDate).toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
        });
        const formattedTime = new Date(`2000-01-01T${appointmentTime}`).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
        });

        // Notify patient
        await notificationService.create(
            patientId,
            'Appointment Confirmed',
            `Your appointment with ${doctorName} on ${formattedDate} at ${formattedTime} has been booked successfully.`,
            'success'
        );

        // Notify doctor
        await notificationService.create(
            doctorId,
            'New Appointment Request',
            `${patientName} has booked an appointment with you on ${formattedDate} at ${formattedTime}.`,
            'info'
        );

        return sendResponse(res, 201, true, 'Appointment booked successfully', mapAppointmentToResponse(appointment));
    } catch (error: unknown) {
        logger.error('Error booking appointment:', { 
            error: error instanceof Error ? error.message : String(error), 
            userId: user?.id,
            doctorId
        });
        return sendError(res, 500, 'Error booking appointment');
    }
};


// Get user's appointments
export const getMyAppointments = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { status, upcoming } = req.query;

    try {
        if (!userId) return sendError(res, 401, 'Unauthorized');

        const appointments = await appointmentRepository.findByUserId(
            userId,
            typeof status === 'string' ? status : undefined,
            upcoming === 'true'
        );
        return sendResponse(res, 200, true, 'Appointments fetched successfully', appointments.map(mapAppointmentToResponse));
    } catch (error: unknown) {
        logger.error('Error fetching appointments:', { 
            error: error instanceof Error ? error.message : String(error), 
            userId 
        });
        return sendError(res, 500, 'Error fetching appointments');
    }
};

// Get appointment by ID
export const getAppointmentById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;

    try {
        if (!userId) return sendError(res, 401, 'Unauthorized');

        const appointment = await appointmentRepository.findByIdWithDetails(Number(id), userId);

        if (!appointment) {
            return sendError(res, 404, 'Appointment not found');
        }

        return sendResponse(res, 200, true, 'Appointment details fetched', mapAppointmentToResponse(appointment));
    } catch (error: unknown) {
        logger.error('Error fetching appointment:', { 
            error: error instanceof Error ? error.message : String(error), 
            appointmentId: id 
        });
        return sendError(res, 500, 'Error fetching appointment');
    }
};

// Update appointment status (Doctor)
export const updateAppointmentStatus = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, notes } = req.body as UpdateAppointmentRequest;
    const userId = req.user?.id;

    try {
        if (!userId) return sendError(res, 401, 'Unauthorized');

        const appointment = await appointmentRepository.updateStatus(
            Number(id), 
            userId, 
            typeof status === 'string' ? status : '', 
            typeof notes === 'string' ? notes : ''
        );

        if (!appointment) {
            return sendError(res, 404, 'Appointment not found or access denied');
        }

        return sendResponse(res, 200, true, 'Appointment updated successfully', mapAppointmentToResponse(appointment));
    } catch (error: unknown) {
        logger.error('Error updating appointment:', { 
            error: error instanceof Error ? error.message : String(error), 
            appointmentId: id 
        });
        return sendError(res, 500, 'Error updating appointment');
    }
};

// Cancel appointment
export const cancelAppointment = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;

    try {
        if (!userId) return sendError(res, 401, 'Unauthorized');

        const appointment = await appointmentRepository.cancel(Number(id), userId);

        if (!appointment) {
            return sendError(res, 404, 'Appointment not found or access denied');
        }

        return sendResponse(res, 200, true, 'Appointment cancelled successfully', mapAppointmentToResponse(appointment));
    } catch (error: unknown) {
        logger.error('Error cancelling appointment:', { 
            error: error instanceof Error ? error.message : String(error), 
            appointmentId: id 
        });
        return sendError(res, 500, 'Error cancelling appointment');
    }
};

// Permanently delete a past appointment (Patient only)
export const deleteAppointment = async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = req.user;

    try {
        if (!user) return sendError(res, 401, 'Unauthorized');

        if (user.role !== 'patient') {
            return res.status(403).json({ message: 'Only patients can permanently delete appointments' });
        }

        const deleted = await appointmentRepository.softDelete(Number(id), user.id);

        if (!deleted) {
            return sendError(res, 404, 'Appointment not found, already deleted, or cannot be deleted (only past/completed/cancelled appointments can be deleted)');
        }

        return sendResponse(res, 200, true, 'Appointment deleted successfully');
    } catch (error: unknown) {
        logger.error('Error deleting appointment:', { 
            error: error instanceof Error ? error.message : String(error), 
            appointmentId: id 
        });
        return sendError(res, 500, 'Error deleting appointment');
    }
};

// Get available time slots for a doctor
export const getAvailableSlots = async (req: Request, res: Response) => {
    const { doctor_id, date } = req.query;

    try {
        if (typeof doctor_id !== 'string' || typeof date !== 'string') {
            return res.status(400).json({ message: 'doctor_id and date are required' });
        }
        
        // Get day of week from date using UTC-safe local parsing
        const [year, month, day] = date.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 6 is Saturday

        // Get doctor's schedule for that day (passing integer as defined in init.sql)
        const schedule = await appointmentRepository.getDoctorSchedule(doctor_id, dayOfWeek);

        if (schedule.length === 0) {
            return sendResponse(res, 200, true, 'No slots available', { date, slots: [] });
        }

        // Get booked appointments
        const bookedTimes = await appointmentRepository.getBookedTimes(doctor_id, date);

        const slots: string[] = [];
        for (const row of schedule) {
            const current = new Date(`2000-01-01T${row.start_time}`);
            const end = new Date(`2000-01-01T${row.end_time}`);

            while (current < end) {
                const timeStr = current.toTimeString().slice(0, 5);
                if (!bookedTimes.includes(timeStr)) {
                    slots.push(timeStr);
                }
                current.setMinutes(current.getMinutes() + 30); // 30-min slots
            }
        }

        return sendResponse(res, 200, true, 'Available slots fetched', { date, slots });
    } catch (error: unknown) {
        logger.error('Error fetching available slots:', { 
            error: error instanceof Error ? error.message : String(error), 
            doctorId: doctor_id,
            date
        });
        return sendError(res, 500, 'Error fetching available slots');
    }
};
