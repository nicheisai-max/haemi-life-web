/**
 * 🛡️ HAEMI LIFE: INSTITUTIONAL IDENTITY CONFIGURATION
 * Policy: Deterministic IDs for demo environments to prevent identity drift.
 * Zero-Hallucination: These IDs MUST match the seeding scripts and init.sql exactly.
 */

export const INSTITUTIONAL_IDENTITIES = {
    PHARMACIST: {
        id: process.env.DEMO_PHARMACIST_ID || '5b34c926-381e-4453-bcc0-9ce303b37e25',
        email: 'pharmacist@haemilife.com'
    },
    ADMIN: {
        id: process.env.DEMO_ADMIN_ID || 'a1111111-1111-4111-a111-111111111111',
        email: 'admin@haemilife.com'
    },
    DOCTOR: {
        id: process.env.DEMO_DOCTOR_ID || 'd2222222-2222-4222-a222-222222222222',
        email: 'doctor@haemilife.com'
    },
    PATIENT: {
        id: process.env.DEMO_PATIENT_ID || 'e4444444-4444-4444-a444-444444444444',
        email: 'patient@haemilife.com'
    }
};
