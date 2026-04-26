import { Pool } from 'pg';
import { pool } from '../config/db';
import { logger } from '../utils/logger';

/**
 * Screening Repository
 * Handles direct database operations for the Clinical Screening System.
 */
export class ScreeningRepository {
    private db: Pool;

    constructor(db: Pool = pool) {
        this.db = db;
    }

    /**
     * Link an existing screening record to an appointment
     */
    async linkToAppointment(screeningId: string, appointmentId: number): Promise<boolean> {
        try {
            const query = `
                UPDATE patient_screening_records 
                SET appointment_id = $1 
                WHERE id = $2
            `;
            const result = await this.db.query(query, [appointmentId, screeningId]);
            return (result.rowCount ?? 0) > 0;
        } catch (error: unknown) {
            logger.error('[ScreeningRepository] Failed to link screening to appointment', {
                error: error instanceof Error ? error.message : String(error),
                screeningId,
                appointmentId
            });
            return false;
        }
    }
}

export const screeningRepository = new ScreeningRepository();
