import { pool } from '../config/db';
import bcrypt from 'bcrypt';

const DEMO_PASSWORD = 'Demo@2026';
const SALT_ROUNDS = 10;

async function seedBotswanaDemo() {
    console.log('💎 Starting Botswana Investor-Demo Seeding (v8 - Final Push)...\n');

    try {
        const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

        await pool.query('BEGIN');

        // 1. Ensure Missing Tables exist
        console.log('🏗️ Ensuring missing demo tables exist...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS appointments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
                doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
                appointment_date DATE NOT NULL,
                appointment_time TIME NOT NULL,
                status TEXT DEFAULT 'SCHEDULED',
                reason TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS doctor_schedules (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
                day_of_week INTEGER,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                is_available BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        // 2. Clear Existing Data
        console.log('🧹 Clearing existing demo data...');
        // Order of truncation matters
        await pool.query('TRUNCATE TABLE order_items, orders, pharmacy_inventory, pharmacies, prescription_items, prescriptions, appointments, doctor_schedules, doctor_profiles, medicines, users CASCADE');

        // 3. Seed Medicines
        console.log('💊 Seeding Pharmaceutical Inventory...');
        const meds = [
            ['Panado Extra', 'Analgesic', '500mg', 'Adcock Ingram'],
            ['Amoxil', 'Antibiotic', '500mg', 'GSK'],
            ['Ventolin', 'Bronchodilator', '100mcg', 'GSK'],
            ['Lipitor', 'Statin', '20mg', 'Pfizer'],
            ['Glucofree', 'Antidiabetic', '500mg', 'LocalGen'],
            ['TensioStop', 'Antihypertensive', '10mg', 'BotswanaMed']
        ];

        const medsWithIds = [];
        for (const med of meds) {
            const res = await pool.query(
                'INSERT INTO medicines (name, category, strength, manufacturer, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
                med
            );
            medsWithIds.push(res.rows[0].id);
        }

        // 4. Seed Pharmacies
        console.log('🏥 Seeding Botswana Pharmacies...');
        const pharmacies = [
            ['Link Pharmacy - Airport Junction', 'Gaborone', 'Shop 23, Airport Junction Mall', '+267 391 2345'],
            ['Clicks Pharmacy - Game City', 'Gaborone', 'Game City Mall, Unit 5', '+267 395 6789'],
        ];

        const pharmacyIds = [];
        for (const p of pharmacies) {
            const res = await pool.query(
                'INSERT INTO pharmacies (name, city, address, phone_number, is_active, created_at) VALUES ($1, $2, $3, $4, true, NOW()) RETURNING id',
                p
            );
            pharmacyIds.push(res.rows[0].id);

            for (const medId of medsWithIds) {
                await pool.query(
                    'INSERT INTO pharmacy_inventory (pharmacy_id, medicine_id, price, stock_quantity, created_at) VALUES ($1, $2, $3, $4, NOW())',
                    [res.rows[0].id, medId, 125, 50]
                );
            }
        }

        // 5. Seed Users
        console.log('👥 Creating Demo Personas...');

        const adminRes = await pool.query(
            `INSERT INTO users (name, email, phone_number, password, role, is_active, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW()) RETURNING id`,
            ['Admin Kgosi', 'admin@haemi.life', '+267 71000001', hashedPassword, 'admin']
        );

        const resDoc = await pool.query(
            `INSERT INTO users (name, email, phone_number, password, role, is_active, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW()) RETURNING id`,
            ['Dr. Mpho Modise', 'dr.mpho@haemi.life', '+267 72123456', hashedPassword, 'doctor']
        );
        const docId = resDoc.rows[0].id;
        await pool.query(
            `INSERT INTO doctor_profiles (user_id, specialization, license_number, years_of_experience, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [docId, 'Cardiologist', 'BW-MD-101', 12]
        );

        const ptRes = await pool.query(
            `INSERT INTO users (name, email, phone_number, password, role, id_number, is_active, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW()) RETURNING id`,
            ['Kagiso Moalusi', 'kagiso@demo.life', '+267 73456789', hashedPassword, 'patient', '456710111']
        );
        const ptId = ptRes.rows[0].id;

        const phRes = await pool.query(
            `INSERT INTO users (name, email, phone_number, password, role, is_active, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW()) RETURNING id`,
            ['Pule Seretse', 'pule.pharm@haemi.life', '+267 74123456', hashedPassword, 'pharmacist']
        );

        // 6. History
        console.log('📅 Simulating Clinical History...');
        await pool.query(
            `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status, reason)
             VALUES ($1, $2, CURRENT_DATE, '10:00:00', 'SCHEDULED', 'Wellness Check')`,
            [ptId, docId]
        );

        const prescRes = await pool.query(
            `INSERT INTO prescriptions (patient_id, doctor_id, status, notes, created_at)
             VALUES ($1, $2, 'ACTIVE', 'Antibiotics.', NOW()) RETURNING id`,
            [ptId, docId]
        );

        await pool.query(
            `INSERT INTO prescription_items (prescription_id, medicine_id, dosage, duration_days)
                VALUES ($1, $2, '500mg', 7)`,
            [prescRes.rows[0].id, medsWithIds[0]]
        );

        // Orders
        console.log('📦 Seeding Pharmacy Orders...');
        // I will use 'PENDING' carefully.
        await pool.query(
            `INSERT INTO orders (patient_id, pharmacy_id, total_amount, status, created_at)
             VALUES ($1, $2, 350.00, 'PENDING', NOW())`,
            [ptId, pharmacyIds[0]]
        );

        await pool.query('COMMIT');
        console.log('\n✨ Botswana Demo Seeding FINALIZED!');

    } catch (error) {
        if (pool) await pool.query('ROLLBACK');
        console.error('❌ Seeding Failed:', error);
    } finally {
        process.exit();
    }
}

seedBotswanaDemo();
