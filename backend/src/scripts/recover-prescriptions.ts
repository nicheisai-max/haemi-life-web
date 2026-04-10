import { pool } from '../config/db';
import { logger } from '../utils/logger';

/**
 * 🩺 HAEMI LIFE — CLINICAL DATA RECOVERY SCRIPT (v1.0)
 * Performs permanent metadata correction for legacy prescriptions.
 * Target: 'General Record' entries with 'prescription' in the filename.
 */

async function recoverPrescriptions() {
    logger.info('[Recovery-Script] Initiating permanent clinical metadata correction...');
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const updateQuery = `
            UPDATE medical_records 
            SET record_type = 'Prescription' 
            WHERE name ILIKE '%prescription%' 
            AND record_type = 'General Record'
            RETURNING id, name;
        `;

        const result = await client.query(updateQuery);
        
        await client.query('COMMIT');

        logger.info(`[Recovery-Script] Institutional correction complete. ${result.rowCount} records recovered.`);
        
        if (result.rows.length > 0) {
            logger.info('[Recovery-Script] Recovered Asset IDs:', result.rows.map(r => r.id).join(', '));
        }

    } catch (error: unknown) {
        await client.query('ROLLBACK');
        logger.error('[Recovery-Script] Critical failure during clinical data recovery:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
        logger.info('[Recovery-Script] DB connection closed.');
    }
}

recoverPrescriptions().catch(err => {
    console.error('Fatal script error:', err);
    process.exit(1);
});
