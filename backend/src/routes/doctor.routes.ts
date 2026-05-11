import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import {
    listDoctors,
    getDoctorProfile,
    getSpecializations,
    updateDoctorProfile,
    getDoctorSchedule,
    updateDoctorSchedule,
    updateDoctorClinicTimezone,
    getDoctorPatients,
    getDoctorPatientProfile,
    createPatientInvite,
    listPatientInvites,
    revokePatientInvite,
} from '../controllers/doctor.controller';

const router = Router();

// Public named routes — MUST be before /:id wildcard
router.get('/', listDoctors);
router.get('/specializations', getSpecializations);

// Protected routes (Doctor only)
router.put('/profile', authenticateToken, requireRole('doctor'), updateDoctorProfile);
router.get('/me/schedule', authenticateToken, requireRole('doctor'), getDoctorSchedule);
router.put('/me/schedule', authenticateToken, requireRole('doctor'), updateDoctorSchedule);
router.patch('/me/clinic-timezone', authenticateToken, requireRole('doctor'), updateDoctorClinicTimezone);
router.get('/me/patients', authenticateToken, requireRole('doctor'), getDoctorPatients);
router.get('/me/patients/:id', authenticateToken, requireRole('doctor'), getDoctorPatientProfile);

// Doctor → Patient invite flow (Patient Registry PR 3/3)
router.post('/me/invites', authenticateToken, requireRole('doctor'), createPatientInvite);
router.get('/me/invites', authenticateToken, requireRole('doctor'), listPatientInvites);
router.delete('/me/invites/:id', authenticateToken, requireRole('doctor'), revokePatientInvite);

// Wildcard param LAST — must never precede named routes
router.get('/:id', getDoctorProfile);

export default router;
