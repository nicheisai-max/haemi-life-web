import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { getMyRecords, uploadRecord, deleteRecord, getRecordById, getPatientRecords } from '../controllers/record.controller';

const router = Router();

// Configure Multer for file storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/medical_records/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authenticateToken);

// GET is allowed for all authenticated clinical roles (access logic in controller/repo)
router.get('/', getMyRecords);
router.get('/patient/:patientId', getPatientRecords);
router.get('/:id', getRecordById);

// POST/DELETE is restricted to patients (uploading their own data)
router.post('/upload', requireRole('patient'), upload.single('file'), uploadRecord);
router.delete('/:id', requireRole('patient'), deleteRecord);

export default router;