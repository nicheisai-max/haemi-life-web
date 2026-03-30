// --------------------------------------------------------------------------------
// HAEMI LIFE -- SAFE SEED SCRIPT (BOTSWANA REAL DATA) -- v3.0
// "The Source of Truth"
//
// 1. NON-DESTRUCTIVE: Checks if user exists (by email) before inserting.
// 2. BOTSWANA DATA: Authentic names, roles, and locations.
// 3. COMPLETE ROLES: Admins, Doctors, Pharmacists, Patients (10+ each).
// --------------------------------------------------------------------------------

import { pool } from '../config/db';
import bcrypt from 'bcrypt';

const BOTSWANA_NAMES = {
    first: [
        'Thabo', 'Neo', 'Kagiso', 'Lorato', 'Mpho', 'Tshepo', 'Amantle', 'Tumelo',
        'Bakang', 'Sethunya', 'Kabo', 'Goitseone', 'Lesego', 'Pako', 'Tefo',
        'Refilwe', 'Kgalalelo', 'Modise', 'Khumo', 'Tlamelo', 'Boitumelo', 'Karabo',
        'Katlego', 'Onkemetse', 'Tshiamo'
    ],
    last: [
        'Kgosi', 'Molefe', 'Mousi', 'Dube', 'Seretse', 'Motlhabane', 'Kwape',
        'Sechele', 'Ntsima', 'Phiri', 'Mogwe', 'Moloi', 'Gabaraane', 'Masire',
        'Khama', 'Seboni', 'Motswaledi', 'Boko', 'Masisi', 'Molale', 'Chiepe',
        'Gaolathe', 'Matthews', 'Nasha', 'Skelemani'
    ]
};

// Removed unused LOCATIONS and SPECIALIZATIONS constants to satisfy lint

// Helper to generate distinct Botswana specific data
const generateBotswanaUser = (role: string, index: number, specificData: Record<string, unknown> = {}) => {
    const firstName = BOTSWANA_NAMES.first[index % BOTSWANA_NAMES.first.length];
    const lastName = BOTSWANA_NAMES.last[index % BOTSWANA_NAMES.last.length];
    const name = (specificData.name as string) || `${firstName} ${lastName}`;
    const email = (specificData.email as string) || `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@haemilife.com`;
    const phone = (specificData.phone as string) || `+2677${index}${Math.floor(Math.random() * 900000 + 100000)}`; // +267 7X XXXXXX

    return { name, email, phone, role, ...specificData };
};

const safeCreateUser = async (client: import('pg').PoolClient, userData: Record<string, unknown>, passwordHash: string) => {
    // 1. Check if user exists
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [userData.email]);

    if (existing.rows.length > 0) {
        console.log(`⏩ Skipping Existing User: ${userData.email}`);
        return existing.rows[0].id;
    }

    // 2. Insert new user
    const res = await client.query(`
        INSERT INTO users (name, email, password, role, phone_number, id_number, status, is_verified)
        VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', true)
        RETURNING id
    `, [
        userData.name,
        userData.email,
        passwordHash,
        userData.role,
        userData.phone,
        userData.id_number || null
    ]);

    console.log(`✅ Created New ${userData.role}: ${userData.name}`);
    return res.rows[0].id;
};

const seedMedicalRecords = async (client: import('pg').PoolClient, patientId: string, patientName: string) => {
    // Check if records exist to avoid duplicates
    const check = await client.query('SELECT id FROM medical_records WHERE patient_id = $1 LIMIT 1', [patientId]);
    if (check.rows.length > 0) {
        console.log(`   ⏩ Records exist for ${patientName}, skipping insertion.`);
        return;
    }

    console.log(`   📂 Seeding Records for: ${patientName}`);

    const records = [
        {
            name: "Initial Health Assessment",
            record_type: "Clinical Note",
            doctor_name: "Dr. Thabo Kgosi",
            facility_name: "Princess Marina Hospital",
            status: "Final",
            notes: "Patient reports general well-being. Routine screening conducted.",
            file_path: "uploads/medical_records/demo_initial_assessment.pdf", // Placeholder
            file_mime: "application/pdf",
            file_size: "1.2 MB"
        }
    ];

    for (const record of records) {
        await client.query(`
            INSERT INTO medical_records 
            (patient_id, name, record_type, doctor_name, facility_name, date_of_service, status, notes, file_path, file_mime, file_size)
            VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, $7, $8, $9, $10)
        `, [
            patientId,
            record.name,
            record.record_type,
            record.doctor_name,
            record.facility_name,
            record.status,
            record.notes,
            record.file_path,
            record.file_mime,
            record.file_size
        ]);
    }
};


const seed = async () => {
    const client = await pool.connect();

    try {
        console.log('🌱 Starting SAFE SEEDING (Botswana Data)...');
        await client.query('BEGIN');

        const passwordHash = await bcrypt.hash('HaemiLifeDemo@2026', 10); // Uniform password for official demo

        // --- 1. ADMINS (10 Records) ---
        console.log('\n--- 1. SEEDING ADMINS ---');
        // Ensure the primary admin exists first
        await safeCreateUser(client, { name: 'Super Admin', email: 'admin@haemilife.com', phone: '+26771000000', role: 'admin' }, passwordHash);

        for (let i = 1; i <= 10; i++) {
            const admin = generateBotswanaUser('admin', i, {
                email: `admin${i}@haemilife.com` // Simple emails for easier testing
            });
            await safeCreateUser(client, admin, passwordHash);
        }

        // --- 2. PHARMACISTS (10 Records) ---
        console.log('\n--- 2. SEEDING PHARMACISTS ---');
        // Primary pharmacist
        await safeCreateUser(client, { name: 'Head Pharmacist', email: 'pharmacist@haemilife.com', phone: '+26772000000', role: 'pharmacist' }, passwordHash);

        for (let i = 1; i <= 10; i++) {
            const pharm = generateBotswanaUser('pharmacist', i + 10, { // Offset index to vary names slightly
                email: `pharmacist${i}@haemilife.com`
            });
            await safeCreateUser(client, pharm, passwordHash);
        }

        // --- 3. PATIENTS (10 Records) ---
        console.log('\n--- 3. SEEDING PATIENTS ---');
        // Primary patient
        const primaryPatientId = await safeCreateUser(client, { name: 'Main Patient', email: 'patient@haemilife.com', phone: '+26773000000', role: 'patient', id_number: '100110011' }, passwordHash);
        await seedMedicalRecords(client, primaryPatientId, 'Main Patient');

        for (let i = 1; i <= 10; i++) {
            const patient = generateBotswanaUser('patient', i + 20, {
                email: `patient${i}@haemilife.com`,
                id_number: `1002200${i}`
            });
            const pId = await safeCreateUser(client, patient, passwordHash);
            await seedMedicalRecords(client, pId, patient.name);
        }

        // --- 4. DOCTORS (10+ Records with Profiles) ---
        console.log('\n--- 4. SEEDING DOCTORS ---');
        // Primary doctor
        const mainDocId = await safeCreateUser(client, { name: 'Dr. Kobus', email: 'doctor@haemilife.com', phone: '+26774000000', role: 'doctor' }, passwordHash);

        // Ensure profile for main doctor
        const mainProfileCheck = await client.query('SELECT id FROM doctor_profiles WHERE user_id = $1', [mainDocId]);
        if (mainProfileCheck.rows.length === 0) {
            await client.query(`
                INSERT INTO doctor_profiles (user_id, specialization, license_number, years_of_experience, bio, consultation_fee, is_verified)
                VALUES ($1, 'General Practitioner', 'BW-MD-MAIN', 10, 'Chief Medical Officer', 500.00, true)
            `, [mainDocId]);
        }

        // Array of 10 Specific Doctors (some might match previous seed, which is fine, exact emails will trigger skip)
        const doctorsData = [
            { name: 'Dr. Thabo Kgosi', email: 'thabo.kgosi@haemilife.com', spec: 'Cardiologist', exp: 18, fee: 1200 },
            { name: 'Dr. Lorato Molefe', email: 'lorato.molefe@haemilife.com', spec: 'Pediatrician', exp: 12, fee: 850 },
            { name: 'Dr. Neo Mousi', email: 'neo.mousi@haemilife.com', spec: 'General Practitioner', exp: 8, fee: 400 },
            { name: 'Dr. Kagiso Dube', email: 'kagiso.dube@haemilife.com', spec: 'Dermatologist', exp: 15, fee: 950 },
            { name: 'Dr. Mpho Seretse', email: 'mpho.seretse@haemilife.com', spec: 'Gynecologist', exp: 20, fee: 1100 },
            { name: 'Dr. Tshepo Motlhabane', email: 'tshepo.mot@haemilife.com', spec: 'Orthopedic Surgeon', exp: 14, fee: 1500 },
            { name: 'Dr. Amantle Kwape', email: 'amantle.kwape@haemilife.com', spec: 'Neurologist', exp: 10, fee: 1300 },
            { name: 'Dr. Tumelo Sechele', email: 'tumelo.sech@haemilife.com', spec: 'Psychiatrist', exp: 16, fee: 1000 },
            { name: 'Dr. Bakang Ntsima', email: 'bakang.n@haemilife.com', spec: 'Ophthalmologist', exp: 9, fee: 900 },
            { name: 'Dr. Sethunya Phiri', email: 'sethunya.p@haemilife.com', spec: 'Oncologist', exp: 22, fee: 1400 }
        ];

        for (let i = 0; i < doctorsData.length; i++) {
            const doc = doctorsData[i];
            const userId = await safeCreateUser(client, {
                name: doc.name,
                email: doc.email,
                phone: `+26776${100000 + i}`, // Unique phone
                role: 'doctor'
            }, passwordHash);

            // Check profile
            const profileCheck = await client.query('SELECT id FROM doctor_profiles WHERE user_id = $1', [userId]);
            if (profileCheck.rows.length === 0) {
                await client.query(`
                    INSERT INTO doctor_profiles (user_id, specialization, license_number, years_of_experience, bio, consultation_fee, is_verified)
                    VALUES ($1, $2, $3, $4, $5, $6, true)
                `, [
                    userId,
                    doc.spec,
                    `BW-MD-202X-${i}`,
                    doc.exp,
                    `Expert ${doc.spec} serving the Botswana community.`,
                    doc.fee
                ]);
                console.log(`   ✅ Created Profile for: ${doc.name}`);

                // Create Default Schedule (1=Mon to 5=Fri)
                const days = [1, 2, 3, 4, 5];
                for (const day of days) {
                    await client.query(`
                        INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available)
                        VALUES ($1, $2, '08:00:00', '17:00:00', true)
                    `, [userId, day]);
                }
            } else {
                console.log(`   ⏩ Profile exists for: ${doc.name}`);
            }
        }

        await client.query('COMMIT');
        console.log('\n✨ Database Seeding Completed Successfully! 🇧🇼');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
};

seed();
