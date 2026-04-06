import multer from 'multer';
import { Request } from 'express';

const storage = multer.memoryStorage();

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const mimetype = file.mimetype.toLowerCase();

    // 🔒 BLOCK: Executable / Dangerous types (Institutional Standard)
    const blockedTypes = [
        'application/x-msdownload', // .exe, .dll
        'application/x-sh',         // .sh
        'application/x-bat',        // .bat
        'application/octet-stream'  // Generic binary (use with caution)
    ];

    if (blockedTypes.includes(mimetype)) {
        return cb(new Error('Institutional Security: Unsupported or dangerous file type blocked.'));
    }

    // 🩺 ALLOW: Medical Images/Documents/Structured Data
    if (
        mimetype.startsWith('image/') ||
        mimetype.startsWith('application/pdf') ||
        mimetype.startsWith('application/msword') ||
        mimetype.indexOf('officedocument') !== -1 ||
        mimetype.startsWith('text/csv') ||
        mimetype.startsWith('text/plain')
    ) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only diagnostic images and clinical documents are allowed.'));
    }
};

export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});
