import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import {
    listDoctors,
    getDoctorProfile,
    getSpecializations,
    updateDoctorProfile,
    getDoctorSchedule,
    updateDoctorSchedule,
    getDoctorPatients
} from '../controllers/doctor.controller';

const router = Router();

// Public named routes — MUST be before /:id wildcard
router.get('/', listDoctors);
router.get('/specializations', getSpecializations);

// Protected routes (Doctor only)
router.put('/profile', authenticateToken, requireRole('doctor'), updateDoctorProfile);
router.get('/me/schedule', authenticateToken, requireRole('doctor'), getDoctorSchedule);
router.put('/me/schedule', authenticateToken, requireRole('doctor'), updateDoctorSchedule);
router.get('/me/patients', authenticateToken, requireRole('doctor'), getDoctorPatients);

// Wildcard param LAST — must never precede named routes
router.get('/:id', getDoctorProfile);

export default router;
