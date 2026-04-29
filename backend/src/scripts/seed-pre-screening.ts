import { pool } from '../config/db';
import { logger } from '../utils/logger';

/**
 * 🩺 HAEMI LIFE: CLINICAL PRE-SCREENING SEEDER (v1.0)
 * Policy: Additive Question Bank for Patient Triage.
 * Target: TB, Diabetes, Hypertension (Botswana Health Protocol).
 */

async function seedPreScreening() {
    const client = await pool.connect();
    try {
        console.log('\n--- 🩺 HAEMI LIFE: CLINICAL SEEDING START ---');
        await client.query('BEGIN');

        const questions = [
            // --- TIER 1: CHRONIC SELF-DECLARATION (Expanded) ---
            { category: 'self-declaration', disease_tag: 'hypertension', question_text: 'Are you currently diagnosed with Hypertension (High Blood Pressure)?', risk_weight: 0.2, sort_order: 10 },
            { category: 'self-declaration', disease_tag: 'diabetes', question_text: 'Are you currently diagnosed with Diabetes?', risk_weight: 0.2, sort_order: 20 },
            { category: 'self-declaration', disease_tag: 'tb', question_text: 'Have you ever been treated for Tuberculosis (TB)?', risk_weight: 0.3, sort_order: 30 },
            { category: 'self-declaration', disease_tag: 'hiv', question_text: 'Are you currently on ARV therapy or diagnosed with HIV?', risk_weight: 0.4, sort_order: 40 },
            { category: 'self-declaration', disease_tag: 'respiratory', question_text: 'Do you suffer from chronic Asthma or COPD?', risk_weight: 0.3, sort_order: 50 },
            { category: 'self-declaration', disease_tag: 'cardiovascular', question_text: 'Have you ever had a stroke or a heart attack?', risk_weight: 0.5, sort_order: 60 },
            
            // --- TIER 2: ACUTE SYMPTOM TRIAGE (Refined) ---
            { category: 'triage', disease_tag: 'tb', question_text: 'Have you had a persistent cough for more than 3 weeks?', risk_weight: 0.8, sort_order: 100 },
            { category: 'triage', disease_tag: 'infectious', question_text: 'Are you experiencing drenching night sweats or recurring fever?', risk_weight: 0.7, sort_order: 110 },
            { category: 'triage', disease_tag: 'diabetes', question_text: 'Are you experiencing excessive thirst or frequent urination?', risk_weight: 0.5, sort_order: 120 },
            { category: 'triage', disease_tag: 'hypertension', question_text: 'Are you experiencing blurred vision or severe headaches?', risk_weight: 0.7, sort_order: 130 },
            { category: 'triage', disease_tag: 'oncology', question_text: 'Have you noticed any unusual swellings or lumps in your body?', risk_weight: 0.6, sort_order: 140 },

            // --- TIER 3: RISK & LIFESTYLE ASSESSMENT (New) ---
            { category: 'risk-assessment', disease_tag: 'lifestyle', question_text: 'Is there a history of regular smoking or tobacco consumption?', risk_weight: 0.3, sort_order: 200 },
            { category: 'risk-assessment', disease_tag: 'lifestyle', question_text: 'Regular or excessive alcohol consumption?', risk_weight: 0.2, sort_order: 210 },
            { category: 'risk-assessment', disease_tag: 'genetics', question_text: 'Any family history of early-onset heart disease or cancer?', risk_weight: 0.4, sort_order: 220 }
        ];

        for (const q of questions) {
            // Check if question already exists to prevent duplication
            const check = await client.query('SELECT id FROM pre_screening_definitions WHERE question_text = $1', [q.question_text]);
            
            if (check.rows.length === 0) {
                await client.query(`
                    INSERT INTO pre_screening_definitions (category, question_text, disease_tag, risk_weight, sort_order)
                    VALUES ($1, $2, $3, $4, $5)
                `, [q.category, q.question_text, q.disease_tag, q.risk_weight, q.sort_order]);
            } else {
                // Update existing to ensure risk weights and orders are fresh
                await client.query(`
                    UPDATE pre_screening_definitions 
                    SET category = $1, disease_tag = $2, risk_weight = $3, sort_order = $4
                    WHERE id = $5
                `, [q.category, q.disease_tag, q.risk_weight, q.sort_order, check.rows[0].id]);
            }
        }

        await client.query('COMMIT');
        console.log('✅ Clinical Question Bank: 3-TIER EXPANSION SUCCESSFUL');
        console.log('--- 🩺 SEEDING COMPLETE ---\n');
    } catch (error: unknown) {
        await client.query('ROLLBACK');
        logger.error('CRITICAL: Pre-screening seeding failed', { error: error instanceof Error ? error.message : String(error) });
        console.error('❌ SEEDING FAILURE: System Interrupted');
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
}

seedPreScreening();
