import { Router } from 'express';
import { authenticateToken, requireRole, authorizeRole } from '../middleware/auth.middleware';
import {
    bookAppointment,
    getMyAppointments,
    getAppointmentById,
    updateAppointmentStatus,
    cancelAppointment,
    deleteAppointment,
    getAvailableSlots
} from '../controllers/appointment.controller';

const router = Router();

// Public/authenticated routes
router.get('/available-slots', getAvailableSlots);

// Protected routes
router.post('/', authenticateToken, requireRole('patient'), bookAppointment);
router.get('/my-appointments', authenticateToken, authorizeRole(['patient', 'doctor']), getMyAppointments);
router.get('/:id', authenticateToken, authorizeRole(['patient', 'doctor']), getAppointmentById);
router.put('/:id/status', authenticateToken, requireRole('doctor'), updateAppointmentStatus);
router.delete('/:id/permanent', authenticateToken, requireRole('patient'), deleteAppointment);
router.delete('/:id', authenticateToken, authorizeRole(['patient', 'doctor']), cancelAppointment);

export default router;
