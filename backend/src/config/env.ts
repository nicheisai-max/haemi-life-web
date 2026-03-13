import * as dotenv from 'dotenv';
import * as path from 'path';
import { logger } from '../utils/logger';

// Explicitly load .env from the root of the backend directory
// This ensures that even when running tests from different directories, 
// the environment variables are consistently loaded.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const REQUIRED_ENV = ['JWT_SECRET', 'DB_PASSWORD', 'GEMINI_API_KEY', 'ENCRYPTION_KEY'];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
    const isDemoMode = process.env.DEMO_MODE === 'true';
    logger.error(`[FATAL] Missing environment variables: ${missingEnv.join(', ')}`);

    // In production, we MUST have these. In demo/dev, we log but might continue.
    if (!isDemoMode && process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
}

export const env = {
    isProduction: process.env.NODE_ENV === 'production',
    isDemoMode: process.env.DEMO_MODE === 'true',
    port: process.env.PORT || 5000,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    allowedOrigins: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : ['http://localhost:5173', 'http://127.0.0.1:5173']
};
