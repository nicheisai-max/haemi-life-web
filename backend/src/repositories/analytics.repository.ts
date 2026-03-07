import { Pool } from 'pg';
import { pool } from '../config/db';

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
        const result = await this.db.query(
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
    }

    async getRevenueStats(limit: number = 6): Promise<RevenueStat[]> {
        const result = await this.db.query(
            `SELECT month as name, revenue, expenses
             FROM revenue_stats 
             ORDER BY created_at ASC 
             LIMIT $1`,
            [limit]
        );
        return result.rows;
    }
}

export const analyticsRepository = new AnalyticsRepository();
