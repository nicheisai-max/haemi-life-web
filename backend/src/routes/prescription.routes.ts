import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireDoctor, requirePharmacist, requirePatientOrDoctor } from '../middleware/role.middleware';
import {
    createPrescription,
    getMyPrescriptions,
    getPrescriptionById,
    updatePrescriptionStatus,
    getPendingPrescriptions
} from '../controllers/prescription.controller';

const router = Router();

// Doctor routes
router.post('/', authenticateToken, requireDoctor, createPrescription);

// Patient/Doctor routes
router.get('/my-prescriptions', authenticateToken, requirePatientOrDoctor, getMyPrescriptions);
router.get('/:id', authenticateToken, getPrescriptionById);

// Pharmacist routes
router.get('/pending/list', authenticateToken, requirePharmacist, getPendingPrescriptions);
router.put('/:id/status', authenticateToken, requirePharmacist, updatePrescriptionStatus);

export default router;
