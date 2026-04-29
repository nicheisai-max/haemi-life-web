
import { Router } from 'express';
import { clinicalCopilotController } from '../controllers/clinical-copilot.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { aiLimiter } from '../middleware/rate-limit.middleware'; // Import the specific rate limiter

const router = Router();

// POST /api/clinical-copilot/chat
// Protected: Only authenticated users with 'doctor' role
router.post(
    '/chat',
    aiLimiter,
    authenticateToken,
    authorizeRole(['doctor']),
    (req, res) => clinicalCopilotController.chat(req, res)
);

// POST /api/clinical-copilot/proactive-insights
// Action: Generates proactive clinical alerts based on patient triage data
router.post(
    '/proactive-insights',
    aiLimiter,
    authenticateToken,
    authorizeRole(['doctor']),
    (req, res) => clinicalCopilotController.getProactiveInsights(req, res)
);

// POST /api/clinical-copilot/analyze-patient-risk
// Action: Analyzes pre-screening responses and returns health insights for the patient
router.post(
    '/analyze-patient-risk',
    aiLimiter,
    authenticateToken,
    (req, res) => clinicalCopilotController.analyzePatientRisk(req, res)
);

export default router;
