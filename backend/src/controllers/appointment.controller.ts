import { Request, Response } from 'express';
import { appointmentRepository } from '../repositories/appointment.repository';
import { preScreeningRepository } from '../repositories/pre-screening.repository';
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
    // Legacy pre-screening responses (inline triage via preScreeningRepository)
    screeningResponses?: Array<{ question_id: string; response_value: boolean }>;
    // New structured clinical record linkage (via screeningRepository)
    screeningRecordId?: string;
}

interface UpdateAppointmentRequest {
    status: string;
    notes?: string;
}

// Book a new appointment (Patient)
export const bookAppointment = async (req: Request, res: Response): Promise<void> => {
    const { doctorId, appointmentDate, appointmentTime, consultationType, reason, screeningResponses, screeningRecordId } = req.body as BookAppointmentRequest;
    const user = req.user;

    try {
        if (!user) {
            sendError(res, 401, 'Unauthorized');
            return;
        }
        const patientId = user.id;

        // Server-clock guard: reject appointments whose start instant has
        // already passed (with the same lead-time buffer the slot list uses).
        // Defense-in-depth against:
        //   - clock-skewed clients,
        //   - stale slot lists held in a tab for hours,
        //   - hand-crafted POSTs that bypass the UI entirely.
        // Both inputs are user-provided strings; we parse defensively so a
        // malformed payload is rejected as 400 rather than silently coerced.
        const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(appointmentDate ?? '');
        const timeMatch = /^(\d{2}):(\d{2})$/.exec(appointmentTime ?? '');
        if (!dateMatch || !timeMatch) {
            sendError(res, 400, 'Invalid appointment date or time format');
            return;
        }
        const [, y, mo, d] = dateMatch;
        const [, hh, mm] = timeMatch;
        const slotInstant = new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), 0, 0);
        const earliestBookableMs = Date.now() + BOOKING_LEAD_TIME_MINUTES * 60_000;
        if (slotInstant.getTime() < earliestBookableMs) {
            sendError(res, 400, 'This appointment slot has already passed. Please choose a future time.');
            return;
        }

        // Validate that doctor exists and is verified
        const isVerified = await appointmentRepository.checkDoctorVerified(doctorId);
        if (!isVerified) {
            sendError(res, 404, 'Doctor not found or not verified');
            return;
        }

        // --- Medical-Grade Safety Guard: Telemedicine Consent ---
        if (consultationType === 'video') {
            // Lazy import to avoid circular dependency issues at the top level
            const { consentRepository } = await import('../repositories/consent.repository');
            const hasConsent = await consentRepository.hasConsent(patientId);
            if (!hasConsent) {
                sendError(res, 403, 'Telemedicine consent required. Please review and sign the digital consent form before booking a video consultation.');
                return;
            }
        }
        // --------------------------------------------------------

        // Check for conflicts
        const hasConflict = await appointmentRepository.checkConflict(doctorId, appointmentDate, appointmentTime);
        if (hasConflict) {
            sendError(res, 409, 'This time slot is already booked');
            return;
        }

        const appointment = await appointmentRepository.create({
            patient_id: patientId,
            doctor_id: doctorId,
            appointment_date: appointmentDate,
            appointment_time: appointmentTime,
            consultation_type: consultationType,
            reason
        });
        
        // --- Clinical Screening Linkage ---
        if (screeningRecordId) {
            const { screeningRepository } = await import('../repositories/screening.repository');
            await screeningRepository.linkToAppointment(screeningRecordId, appointment.id);
            logger.info(`[AppointmentController] Linked screening ${screeningRecordId} to appointment ${appointment.id}`);
        }
        // ----------------------------------

        // --- Clinical Screening Linkage (Institutional Atomic Triage) ---
        if (screeningResponses && Array.isArray(screeningResponses)) {
            try {
                await preScreeningRepository.saveResponses(
                    appointment.id,
                    patientId,
                    screeningResponses
                );
                logger.info(`[AppointmentController] Processed triage for appointment ${appointment.id}`);
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error('[AppointmentController] TRIAGE_LINK_FAILURE intercepted', { 
                    error: errorMessage, 
                    appointmentId: appointment.id 
                });
                
                // Nuclear Audit: Log failure for clinical record keeping
                const { auditService } = await import('../services/audit.service');
                await auditService.log({
                    userId: patientId,
                    action: 'TRIAGE_LINK_FAILURE',
                    entityId: String(appointment.id),
                    entityType: 'APPOINTMENT',
                    metadata: { error: errorMessage }
                }).catch((e: unknown) => logger.error('[AuditService] Critical failure during triage audit', { error: e instanceof Error ? e.message : String(e) }));
                
                // Note: We don't fail the whole booking, but we record the clinical gap.
            }
        }
        // ----------------------------------------------------------------

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

        sendResponse(res, 201, true, 'Appointment booked successfully', mapAppointmentToResponse(appointment));
    } catch (error: unknown) {
        logger.error('Error booking appointment:', {
            error: error instanceof Error ? error.message : String(error),
            userId: user?.id,
            doctorId
        });
        sendError(res, 500, 'Error booking appointment');
    }
};


// Get user's appointments
export const getMyAppointments = async (req: Request, res: Response): Promise<void> => {
    const user = req.user;
    const { status, upcoming } = req.query;

    try {
        if (!user) {
            sendError(res, 401, 'Unauthorized');
            return;
        }
        const userId = user.id;

        const appointments = await appointmentRepository.findByUserId(
            userId,
            typeof status === 'string' ? status : undefined,
            upcoming === 'true'
        );
        sendResponse(res, 200, true, 'Appointments fetched successfully', appointments.map(mapAppointmentToResponse));
    } catch (error: unknown) {
        logger.error('Error fetching appointments:', {
            error: error instanceof Error ? error.message : String(error),
            userId: user?.id
        });
        sendError(res, 500, 'Error fetching appointments');
    }
};

// Get appointment by ID
export const getAppointmentById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const user = req.user;

    try {
        if (!user) {
            sendError(res, 401, 'Unauthorized');
            return;
        }

        const appointment = await appointmentRepository.findByIdWithDetails(Number(id), user.id);

        if (!appointment) {
            sendError(res, 404, 'Appointment not found');
            return;
        }

        sendResponse(res, 200, true, 'Appointment details fetched', mapAppointmentToResponse(appointment));
    } catch (error: unknown) {
        logger.error('Error fetching appointment:', { error: error instanceof Error ? error.message : String(error), appointmentId: id });
        sendError(res, 500, 'Error fetching appointment');
    }
};

// Update appointment status (Doctor)
export const updateAppointmentStatus = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { status, notes } = req.body as UpdateAppointmentRequest;
    const user = req.user;

    try {
        if (!user) {
            sendError(res, 401, 'Unauthorized');
            return;
        }

        const appointment = await appointmentRepository.updateStatus(
            Number(id),
            user.id,
            typeof status === 'string' ? status : '',
            typeof notes === 'string' ? notes : ''
        );

        if (!appointment) {
            sendError(res, 404, 'Appointment not found or access denied');
            return;
        }

        sendResponse(res, 200, true, 'Appointment updated successfully', mapAppointmentToResponse(appointment));
    } catch (error: unknown) {
        logger.error('Error updating appointment:', { error: error instanceof Error ? error.message : String(error), appointmentId: id });
        sendError(res, 500, 'Error updating appointment');
    }
};

// Cancel appointment
export const cancelAppointment = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const user = req.user;

    try {
        if (!user) {
            sendError(res, 401, 'Unauthorized');
            return;
        }

        const appointment = await appointmentRepository.cancel(Number(id), user.id);

        if (!appointment) {
            sendError(res, 404, 'Appointment not found or access denied');
            return;
        }

        sendResponse(res, 200, true, 'Appointment cancelled successfully', mapAppointmentToResponse(appointment));
    } catch (error: unknown) {
        logger.error('Error cancelling appointment:', { error: error instanceof Error ? error.message : String(error), appointmentId: id });
        sendError(res, 500, 'Error cancelling appointment');
    }
};

// Permanently delete a past appointment (Patient only)
export const deleteAppointment = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const user = req.user;

    try {
        if (!user) {
            sendError(res, 401, 'Unauthorized');
            return;
        }

        if (user.role !== 'patient') {
            res.status(403).json({ message: 'Only patients can permanently delete appointments' });
            return;
        }

        const deleted = await appointmentRepository.softDelete(Number(id), user.id);

        if (!deleted) {
            sendError(res, 404, 'Appointment not found, already deleted, or cannot be deleted');
            return;
        }

        sendResponse(res, 200, true, 'Appointment deleted successfully');
    } catch (error: unknown) {
        logger.error('Error deleting appointment:', { error: error instanceof Error ? error.message : String(error), appointmentId: id });
        sendError(res, 500, 'Error deleting appointment');
    }
};

// Get pre-screening questions for appointment booking (Patient)
export const getPreScreeningQuestions = async (_req: Request, res: Response): Promise<void> => {
    try {
        const questions = await preScreeningRepository.getDefinitions('triage');
        sendResponse(res, 200, true, 'Pre-screening questions fetched successfully', questions);
    } catch (error: unknown) {
        logger.error('[AppointmentController] Failed to fetch pre-screening questions', {
            error: error instanceof Error ? error.message : String(error)
        });
        sendError(res, 500, 'Failed to fetch pre-screening questions');
    }
};

// Submit pre-screening responses linked to an appointment (Patient)
export const submitPreScreening = async (req: Request, res: Response): Promise<void> => {
    const user = req.user;
    // P0 TYPE FIX (Phase 12): `appointment_id` is INTEGER in the database,
    // so we accept either a numeric or a numeric-string body and parse to
    // a strict positive integer before invoking the repository.
    const { appointmentId, responses } = req.body as {
        appointmentId: string | number;
        responses: Array<{ question_id: string; response_value: boolean; additional_notes?: string }>;
    };

    try {
        if (!user) {
            sendError(res, 401, 'Unauthorized');
            return;
        }
        if (appointmentId === undefined || appointmentId === null || !responses || !Array.isArray(responses)) {
            sendError(res, 400, 'Appointment ID and valid responses array are required');
            return;
        }

        const parsedAppointmentId = typeof appointmentId === 'number'
            ? appointmentId
            : parseInt(appointmentId, 10);
        if (!Number.isInteger(parsedAppointmentId) || parsedAppointmentId <= 0) {
            sendError(res, 400, 'Appointment ID must be a positive integer');
            return;
        }

        await preScreeningRepository.saveResponses(parsedAppointmentId, user.id, responses);
        sendResponse(res, 200, true, 'Pre-screening responses submitted successfully');
    } catch (error: unknown) {
        logger.error('[AppointmentController] Failed to submit pre-screening responses', {
            error: error instanceof Error ? error.message : String(error),
            userId: user?.id
        });
        sendError(res, 500, 'Failed to submit pre-screening responses');
    }
};

/**
 * Minimum lead time, in minutes, between server-now and the start of a
 * bookable slot. Mirrors the same constant in the frontend `TimeGrid`
 * (defense-in-depth: client filters for UX, server filters for truth).
 */
const BOOKING_LEAD_TIME_MINUTES = 15;

// Get available time slots for a doctor
export const getAvailableSlots = async (req: Request, res: Response): Promise<void> => {
    const { doctorId, date } = req.query;

    try {
        if (typeof doctorId !== 'string' || typeof date !== 'string') {
            res.status(400).json({ message: 'doctorId and date are required' });
            return;
        }

        const [year, month, day] = date.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const dayOfWeek = dateObj.getDay();

        // Reject queries for dates strictly before today on the server clock.
        // (Same-day with no remaining slots returns an empty list, not 400 —
        // the frontend renders a clean "All slots have passed" state.)
        const now = new Date();
        const startOfRequestedDay = new Date(year, month - 1, day);
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (startOfRequestedDay.getTime() < startOfToday.getTime()) {
            sendResponse(res, 200, true, 'Date is in the past', { date, slots: [] });
            return;
        }

        const schedule = await appointmentRepository.getDoctorSchedule(doctorId, dayOfWeek);

        if (schedule.length === 0) {
            sendResponse(res, 200, true, 'No slots available', { date, slots: [] });
            return;
        }

        const bookedTimes = await appointmentRepository.getBookedTimes(doctorId, date);

        const isToday = startOfRequestedDay.getTime() === startOfToday.getTime();
        // For same-day requests, suppress slots that start before
        // (now + lead time). Comparison is done in minutes-since-midnight
        // so it is independent of the schedule-row epoch (`2000-01-01`).
        const earliestMinutes = isToday
            ? now.getHours() * 60 + now.getMinutes() + BOOKING_LEAD_TIME_MINUTES
            : -1;

        const slots: string[] = [];
        for (const row of schedule) {
            const current = new Date(`2000-01-01T${row.start_time}`);
            const end = new Date(`2000-01-01T${row.end_time}`);

            while (current < end) {
                const timeStr = current.toTimeString().slice(0, 5);
                const slotMinutes = current.getHours() * 60 + current.getMinutes();
                const isBookable = !bookedTimes.includes(timeStr) && slotMinutes >= earliestMinutes;
                if (isBookable) {
                    slots.push(timeStr);
                }
                current.setMinutes(current.getMinutes() + 30);
            }
        }

        sendResponse(res, 200, true, 'Available slots fetched', { date, slots });
    } catch (error: unknown) {
        logger.error('Error fetching available slots:', { error: error instanceof Error ? error.message : String(error), doctorId, date });
        sendError(res, 500, 'Error fetching available slots');
    }
};
