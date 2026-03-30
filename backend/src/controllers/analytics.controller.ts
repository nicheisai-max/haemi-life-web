import { Request, Response } from 'express';
import { analyticsRepository } from '../repositories/analytics.repository';
import { sendResponse, sendError } from '../utils/response';
import { logger } from '../utils/logger';

export const getGrowthStats = async (req: Request, res: Response) => {
    try {
        const stats = await analyticsRepository.getGrowthStats();
        return sendResponse(res, 200, true, 'Growth stats fetched', stats);
    } catch (error: unknown) {
        logger.error('Error fetching growth stats:', {
            error: error instanceof Error ? error.message : String(error)
        });
        return sendError(res, 500, 'Server error');
    }
};
