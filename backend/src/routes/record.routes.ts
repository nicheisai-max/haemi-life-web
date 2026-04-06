import { Router } from 'express';
import multer from 'multer';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { getMyRecords, uploadRecord, deleteRecord, getRecordById, getPatientRecords, checkFileExistence } from '../controllers/record.controller';

const router = Router();

// Configure Multer for file storage (Memory favored for controller-level atomic filesystem writes)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

router.use(authenticateToken);

// GET is allowed for all authenticated clinical roles (access logic in controller/repo)
router.get('/', getMyRecords);
router.get('/exists', checkFileExistence); // 🔍 Forensic existence check
router.get('/patient/:patientId', getPatientRecords);
router.get('/:id', getRecordById);

// POST/DELETE is restricted to patients (uploading their own data)
router.post('/upload', requireRole('patient'), upload.single('file'), uploadRecord);
router.delete('/:id', requireRole('patient'), deleteRecord);

export default router;