import { Request, Response } from 'express';
import { analyticsRepository } from '../repositories/analytics.repository';

export const getGrowthStats = async (req: Request, res: Response) => {
    try {
        const stats = await analyticsRepository.getGrowthStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching growth stats:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
