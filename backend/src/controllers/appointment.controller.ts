import { Request, Response } from 'express';
import { appointmentRepository } from '../repositories/appointment.repository';

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
