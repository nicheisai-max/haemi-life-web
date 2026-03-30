import { pool } from '../config/db';
import { logger } from '../utils/logger';

export const consentRepository = {
    async hasConsent(patientId: string): Promise<boolean> {
        try {
            const result = await pool.query<{ id: string }>(
                'SELECT id FROM telemedicine_consents WHERE patient_id = $1',
                [patientId]
            );
            return (result.rowCount ?? 0) > 0;
        } catch (error: unknown) {
            logger.error('Failed to check consent status', {
                error: error instanceof Error ? error.message : String(error),
                patientId
            });
            throw error;
        }
    },

    async recordConsent(patientId: string, ipAddress: string, userAgent: string, signatureData: string, version: string = 'v1.0'): Promise<{ id: string; agreed_at: Date; version: string }> {
        try {
            // Use UPSERT (ON CONFLICT) just in case, though the controller will likely check first.
            const result = await pool.query<{ id: string; agreed_at: Date; version: string }>(
                `INSERT INTO telemedicine_consents (patient_id, ip_address, user_agent, signature_data, version, agreed_at) 
                 VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                 ON CONFLICT (patient_id) 
                 DO UPDATE SET 
                    agreed_at = CURRENT_TIMESTAMP,
                    ip_address = EXCLUDED.ip_address,
                    user_agent = EXCLUDED.user_agent,
                    signature_data = EXCLUDED.signature_data,
                    version = EXCLUDED.version
                 RETURNING id, agreed_at, version`,
                [patientId, ipAddress, userAgent, signatureData, version]
            );
            return result.rows[0];
        } catch (error: unknown) {
            logger.error('Failed to record consent', {
                error: error instanceof Error ? error.message : String(error),
                patientId,
                version
            });
            throw error;
        }
    }
};
