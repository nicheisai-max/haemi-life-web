import { Request, Response } from 'express';
import { analyticsRepository } from '../repositories/analytics.repository';
import { sendResponse, sendError } from '../utils/response';

export const getGrowthStats = async (req: Request, res: Response) => {
    try {
        const stats = await analyticsRepository.getGrowthStats();
        sendResponse(res, 200, true, 'Growth stats fetched', stats);
    } catch (error) {
        console.error('Error fetching growth stats:', error);
        sendError(res, 500, 'Server error');
    }
};
