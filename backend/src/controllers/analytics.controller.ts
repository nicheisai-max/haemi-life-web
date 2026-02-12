import { Request, Response } from 'express';
import { pool } from '../config/db';

export const getGrowthStats = async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT 
                TO_CHAR(date, 'Mon DD') as name, 
                visits as value,
                new_users
             FROM analytics_daily_visits 
             ORDER BY date ASC 
             LIMIT 7`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching growth stats:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
