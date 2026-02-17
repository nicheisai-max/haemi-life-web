import { Pool } from 'pg';
import { pool } from '../config/db';

export interface GrowthStat {
    name: string;
    value: number;
    new_users: number;
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
}

export const analyticsRepository = new AnalyticsRepository();
