import { Router } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import {
    bookAppointment,
    getMyAppointments,
    getAppointmentById,
    updateAppointmentStatus,
    cancelAppointment,
    deleteAppointment,
    getAvailableSlots,
    getPreScreeningQuestions,
    submitPreScreening
} from '../controllers/appointment.controller';

const router = Router();

// Public/authenticated routes
router.get('/available-slots', getAvailableSlots);
router.get('/pre-screening/questions', authenticateToken, getPreScreeningQuestions);

// Protected routes
router.post('/', authenticateToken, authorizeRole(['patient']), bookAppointment);
router.post('/pre-screening/submit', authenticateToken, authorizeRole(['patient']), submitPreScreening);
router.get('/my-appointments', authenticateToken, authorizeRole(['patient', 'doctor']), getMyAppointments);
router.get('/:id', authenticateToken, authorizeRole(['patient', 'doctor']), getAppointmentById);
router.put('/:id/status', authenticateToken, authorizeRole(['doctor']), updateAppointmentStatus);
router.delete('/:id/permanent', authenticateToken, authorizeRole(['patient']), deleteAppointment);
router.delete('/:id', authenticateToken, authorizeRole(['patient', 'doctor']), cancelAppointment);

export default router;
