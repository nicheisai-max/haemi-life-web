import { pool } from '../config/db';

export const consentRepository = {
    async hasConsent(patientId: string): Promise<boolean> {
        const result = await pool.query(
            'SELECT id FROM telemedicine_consents WHERE patient_id = $1',
            [patientId]
        );
        return (result.rowCount ?? 0) > 0;
    },

    async recordConsent(patientId: string, ipAddress: string, userAgent: string, version: string = 'v1.0'): Promise<any> {
        // Use UPSERT (ON CONFLICT) just in case, though the controller will likely check first.
        const result = await pool.query(
            `INSERT INTO telemedicine_consents (patient_id, ip_address, user_agent, version, agreed_at) 
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
             ON CONFLICT (patient_id) 
             DO UPDATE SET 
                agreed_at = CURRENT_TIMESTAMP,
                ip_address = EXCLUDED.ip_address,
                user_agent = EXCLUDED.user_agent,
                version = EXCLUDED.version
             RETURNING id, agreed_at, version`,
            [patientId, ipAddress, userAgent, version]
        );
        return result.rows[0];
    }
};
