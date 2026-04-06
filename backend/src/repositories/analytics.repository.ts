import { Pool } from 'pg';
import { pool } from '../config/db';
import { logger } from '../utils/logger';

export interface GrowthStat {
    name: string;
    value: number;
    new_users: number;
}

export interface RevenueStat {
    name: string;
    revenue: number;
    expenses: number;
}

export class AnalyticsRepository {
    private db: Pool;

    constructor(db: Pool = pool) {
        this.db = db;
    }

    async getGrowthStats(limit: number = 7): Promise<GrowthStat[]> {
        try {
            const result = await this.db.query<GrowthStat>(
                `SELECT 
                    TO_CHAR(date, 'Mon DD') as name, 
                    visits as value,
                    new_users
                 FROM analytics_daily_visits 
                 ORDER BY date ASC 
                 LIMIT $1`,
                [limit]
            );
            return result.rows;
        } catch (error: unknown) {
            logger.error('Failed to fetch growth stats', {
                error: error instanceof Error ? error.message : String(error),
                limit
            });
            throw error;
        }
    }

    async getRevenueStats(limit: number = 6): Promise<RevenueStat[]> {
        try {
            const result = await this.db.query<RevenueStat>(
                `SELECT month as name, revenue, expenses
                 FROM revenue_stats 
                 ORDER BY created_at ASC 
                 LIMIT $1`,
                [limit]
            );
            return result.rows;
        } catch (error: unknown) {
            logger.error('Failed to fetch revenue stats', {
                error: error instanceof Error ? error.message : String(error),
                limit
            });
            throw error;
        }
    }
}

export const analyticsRepository = new AnalyticsRepository();
