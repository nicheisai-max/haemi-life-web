import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireDoctor, requirePatient, requirePatientOrDoctor } from '../middleware/role.middleware';
import {
    bookAppointment,
    getMyAppointments,
    getAppointmentById,
    updateAppointmentStatus,
    cancelAppointment,
    getAvailableSlots
} from '../controllers/appointment.controller';

const router = Router();

// Public/authenticated routes
router.get('/available-slots', getAvailableSlots);

// Protected routes
router.post('/', authenticateToken, requirePatient, bookAppointment);
router.get('/my-appointments', authenticateToken, getMyAppointments);
router.get('/:id', authenticateToken, requirePatientOrDoctor, getAppointmentById);
router.put('/:id/status', authenticateToken, requireDoctor, updateAppointmentStatus);
router.delete('/:id', authenticateToken, requirePatientOrDoctor, cancelAppointment);

export default router;
