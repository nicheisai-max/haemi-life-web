/**
 * HAEMI LIFE -- INVESTOR DEMO SEED SCRIPT (BOTSWANA CLINICAL) -- v1.0
 * 
 * NON-DESTRUCTIVE: Uses INSERT ... ON CONFLICT and existence checks.
 * LOCALIZED: Authentic Botswana healthcare context.
 */

import { pool } from '../config/db';
import { logger } from '../utils/logger';

async function seedInvestorData() {
    const client = await pool.connect();
    try {
        logger.info('🌱 Starting INVESTOR DEMO SEEDING (Non-Destructive)...');
        await client.query('BEGIN');

        // 1. Fetch Target Demo IDs
        const doctorRes = await client.query('SELECT id FROM users WHERE email = $1', ['doctor@haemilife.com']);
        const doctorId = doctorRes.rows[0]?.id;

        const patientRes = await client.query('SELECT id FROM users WHERE email = $1', ['patient@haemilife.com']);
        const patientId = patientRes.rows[0]?.id;

        if (!doctorId || !patientId) {
            throw new Error('P0_CRITICAL: Demo Doctor or Patient not found in identity registry.');
        }

        logger.info(`✅ Target IDs acquired: Doctor(${doctorId}), Patient(${patientId})`);

        // 2. Seed Analytics: Daily Visits (30 Day Trend)
        logger.info('📊 Seeding 30-day analytics trend...');
        for (let i = 30; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            // Generate a steady growth curve with some noise
            const baseVisits = 400 + (30 - i) * 15;
            const noise = Math.floor(Math.random() * 50);
            const visits = baseVisits + noise;
            const newUsers = Math.floor(visits * 0.08);

            await client.query(`
                INSERT INTO analytics_daily_visits (date, visits, new_users)
                VALUES ($1, $2, $3)
                ON CONFLICT (date) DO UPDATE 
                SET visits = EXCLUDED.visits, 
                    new_users = EXCLUDED.new_users
            `, [dateStr, visits, newUsers]);
        }

        // 3. Seed Revenue Stats (6 Month Performance)
        logger.info('💰 Seeding 6-month revenue performance...');
        const months = ['Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026'];
        const baseRev = 125000; // BWP context
        for (let i = 0; i < months.length; i++) {
            const rev = baseRev + (i * 12000) + Math.floor(Math.random() * 5000);
            const exp = rev * 0.6 + Math.floor(Math.random() * 3000);
            
            await client.query(`
                INSERT INTO revenue_stats (month, revenue, expenses)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
            `, [months[i], rev, exp]);
        }

        // 4. Seed Botswana-Specific Completed Appointments (Performance Drivers)
        logger.info('🩺 Seeding premium clinical encounters (Botswana Specific)...');
        const clinicalEncounters = [
            { reason: 'Hypertension Monitoring', status: 'completed', date_offset: 2, notes: 'Patient responding well to Amlodipine. BP stable at 130/85.' },
            { reason: 'Type 2 Diabetes Review', status: 'completed', date_offset: 5, notes: 'HbA1c check conducted. Adjusted Metformin dosage.' },
            { reason: 'Malaria Prophylaxis', status: 'completed', date_offset: 10, notes: 'Traveler to Okavango Delta. Atovaquone/Proguanil prescribed.' },
            { reason: 'HIV/AIDS Routine review', status: 'completed', date_offset: 15, notes: 'Viral load suppressed. Multi-month dispensing approved.' },
            { reason: 'Pediatric Vaccination', status: 'completed', date_offset: 20, notes: 'Routine EPI schedule followed. No adverse reactions.' },
            { reason: 'Antenatal Care (Phase 2)', status: 'completed', date_offset: 25, notes: 'Fetal heart rate normal. Iron supplements provided.' },
            { reason: 'Post-Op Follow-up', status: 'completed', date_offset: 28, notes: 'Wound healing well. Sutures removed.' },
            { reason: 'General Health Checkup', status: 'completed', date_offset: 35, notes: 'Comprehensive screening. Patient advised on high salt diet risks.' }
        ];

        for (const encounter of clinicalEncounters) {
            const date = new Date();
            date.setDate(date.getDate() - encounter.date_offset);
            const dateStr = date.toISOString().split('T')[0];

            // Check for existing appointment on this date for this patient/doctor to avoid duplicates
            const existing = await client.query(`
                SELECT id FROM appointments 
                WHERE patient_id = $1 AND doctor_id = $2 AND appointment_date = $3 AND reason = $4
            `, [patientId, doctorId, dateStr, encounter.reason]);

            if (existing.rows.length === 0) {
                await client.query(`
                    INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status, reason, notes, consultation_type)
                    VALUES ($1, $2, $3, '10:00:00', $4, $5, $6, 'video')
                `, [patientId, doctorId, dateStr, encounter.status, encounter.reason, encounter.notes]);
            }
        }

        // 5. Seed Medical Records (High-Performance Clinical Artifacts)
        logger.info('📂 Seeding localized clinical artifacts...');
        const records = [
            { name: 'Blood_Sugar_Protocol_BWP.pdf', type: 'Lab Result', facility: 'Sidilega Private Hospital' },
            { name: 'Cardiology_Baseline_PMH.pdf', type: 'Clinical Note', facility: 'Princess Marina Hospital' },
            { name: 'Rad_ChestXRay_GP.jpg', type: 'Radiology', facility: 'Gaborone Private Hospital' }
        ];

        for (const record of records) {
            const existing = await client.query('SELECT id FROM medical_records WHERE patient_id = $1 AND name = $2', [patientId, record.name]);
            if (existing.rows.length === 0) {
                await client.query(`
                    INSERT INTO medical_records (patient_id, name, record_type, doctor_name, facility_name, date_of_service, status, file_path, file_mime, file_size)
                    VALUES ($1, $2, $3, 'Dr. Mpho Modise', $4, CURRENT_DATE - INTERVAL '10 days', 'Final', 'uploads/medical_records/demo_investor.pdf', 'application/pdf', '1.5 MB')
                `, [patientId, record.name, record.type, record.facility]);
            }
        }

        await client.query('COMMIT');
        logger.info('✨ INVESTOR DEMO SEEDING COMPLETED SUCCESSFULLY! 🇧🇼');

    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('❌ FATAL: Investor Seeding Failed', { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

seedInvestorData();
