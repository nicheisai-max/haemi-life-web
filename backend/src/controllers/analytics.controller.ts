import { Request, Response } from 'express';
import { analyticsRepository } from '../repositories/analytics.repository';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';

export const getGrowthStats = async (req: Request, res: Response) => {
    try {
        const stats = await analyticsRepository.getGrowthStats();
        return sendResponse(res, 200, true, 'Growth stats fetched successfully', stats);
    } catch (error: unknown) {
        logger.error('[AnalyticsController] Growth stats fetch failure', { 
            error: error instanceof Error ? error.message : String(error) 
        });
        return sendError(res, 500, 'Failed to fetch growth stats');
    }
};

export const getPerformanceStats = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;

        if (!userId || role !== 'doctor') {
            return sendError(res, 403, 'Only doctors can access clinical performance metrics');
        }

        logger.info('[AnalyticsController] Fetching clinical performance', { doctorId: userId });
        const stats = await analyticsRepository.getClinicalPerformance(userId);
        
        return sendResponse(res, 200, true, 'Clinical performance data fetched successfully', stats);
    } catch (error: unknown) {
        logger.error('[AnalyticsController] Performance fetch failure', { 
            error: error instanceof Error ? error.message : String(error) 
        });
        return sendError(res, 500, 'Failed to fetch clinical performance analytics');
    }
};
