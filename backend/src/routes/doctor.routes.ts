import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireDoctor } from '../middleware/role.middleware';
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

// Public routes
router.get('/', listDoctors);
router.get('/specializations', getSpecializations);
router.get('/:id', getDoctorProfile);

// Protected routes (Doctor only)
router.put('/profile', authenticateToken, requireDoctor, updateDoctorProfile);
router.get('/me/schedule', authenticateToken, requireDoctor, getDoctorSchedule);
router.put('/me/schedule', authenticateToken, requireDoctor, updateDoctorSchedule);
router.get('/me/patients', authenticateToken, requireDoctor, getDoctorPatients);

export default router;
