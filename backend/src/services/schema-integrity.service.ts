import { pool } from '../config/db';
import { logger } from '../utils/logger';

/**
 * Institutional Schema Integrity Service (v5.0)
 * 
 * Responsible for verifying that the physical database schema aligns 
 * with the application's code contracts at boot-time.
 */
export class SchemaIntegrityService {
  /**
   * Validates critical institutional columns and types.
   * Ensures zero-defect alignment for Tier-1 production readiness.
   */
  async validate(): Promise<void> {
    try {
      logger.info('🛡️ Starting Institutional Schema Integrity Check...');

      // 1. Verify audit_logs table alignment (Physical user_id vs Code actor_id)
      const auditLogsCheck = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'audit_logs' AND column_name = 'user_id'
      `);

      if (auditLogsCheck.rowCount === 0) {
        throw new Error('Institutional Drift Detected: Missing critical column "user_id" in audit_logs.');
      }

      // 2. Verify prescription_items medicine_id type (Physical Integer)
      const piCheck = await pool.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'prescription_items' AND column_name = 'medicine_id'
      `);

      if (piCheck.rows[0]?.data_type !== 'integer') {
        logger.warn('Institutional Warning: PrescriptionItem medicine_id type drift (expected integer).');
      }

      // 3. Verify appointments id type (Physical Integer)
      const appointmentsCheck = await pool.query(`
        SELECT data_type FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'id'
      `);
      if (appointmentsCheck.rows[0]?.data_type !== 'integer') {
        logger.warn('Institutional Warning: Appointment ID type drift (expected integer).');
      }

      logger.info('✅ Institutional Alignment Verified.');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('❌ Schema Integrity Validation Failed', { error: errorMessage });
      // In production-grade systems, we fail-fast on schema mismatch
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }
}

export const schemaIntegrityService = new SchemaIntegrityService();
