import { Router } from 'express';
import { getLocations, getMedicines, getPharmacies } from '../controllers/common.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Publicly accessible for signup forms, or protected? 
// Usually signup needs locations, so maybe public or semi-protected. 
// For now, let's keep them protected as per general app security, 
// but if signup needs them, we might need a public endpoint.
// User requirement: "No Hard Coding". 
// Let's make locations public so signup can use it.
router.get('/locations', getLocations);

// Medicines and Pharmacies likely need auth
router.get('/medicines', authenticateToken, getMedicines);
router.get('/pharmacies', authenticateToken, getPharmacies);

export default router;
