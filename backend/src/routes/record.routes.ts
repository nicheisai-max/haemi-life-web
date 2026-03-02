import { Router } from 'express';
import multer from 'multer';   // ✅ FIXED
import path from 'path';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { getMyRecords, uploadRecord, deleteRecord } from '../controllers/record.controller';

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
router.use(requireRole('patient'));

router.get('/', getMyRecords);
router.post('/upload', upload.single('file'), uploadRecord);
router.delete('/:id', deleteRecord);

export default router;