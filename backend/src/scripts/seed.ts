import { pool } from '../config/db';
import bcrypt from 'bcrypt';

const seedMedicalRecords = async (client: any, patientId: string) => {
    console.log('📂 Seeding Medical Records for Patient:', patientId);

    // Clear existing records for this patient to avoid duplicates if re-seeding without full wipe
    await client.query('DELETE FROM medical_records WHERE patient_id = $1', [patientId]);

    const records = [
        {
            name: "Full Blood Count (FBC) Report",
            record_type: "Lab Result",
            doctor_name: "Dr. Thabo Kgosi",
            facility_name: "Princess Marina Hospital",
            date_of_service: "2025-11-15",
            status: "Final",
            notes: "HbA1c levels slightly elevated (6.2%). Lipid profile within normal range.",
            file_path: "uploads/medical_records/demo_fbc_report.pdf",
            file_type: "application/pdf",
            file_size: "1.2 MB"
        },
        {
            name: "Chest X-Ray (PA View)",
            record_type: "Radiology",
            doctor_name: "Dr. Lerato Molefe",
            facility_name: "Bokamoso Private Hospital",
            date_of_service: "2026-01-10",
            status: "Final",
            notes: "Clear lung fields. No evidence of consolidation or pleural effusion.",
            file_path: "uploads/medical_records/demo_chest_xray.jpg",
            file_type: "image/jpeg",
            file_size: "3.5 MB"
        },
        {
            name: "Annual General Checkup Summary",
            record_type: "Clinical Note",
            doctor_name: "Dr. Neo Mousi",
            facility_name: "Maun General Hospital",
            date_of_service: "2025-08-22",
            status: "Final",
            notes: "Patient in good general health. BP 120/80. BMI 24.5.",
            file_path: "uploads/medical_records/demo_checkup_summary.pdf",
            file_type: "application/pdf",
            file_size: "850 KB"
        },
        {
            name: "Dermatology Consultation",
            record_type: "Specialist Report",
            doctor_name: "Dr. Kagiso Dube",
            facility_name: "Phakalane Specialist Clinic",
            date_of_service: "2025-12-05",
            status: "Final",
            notes: "Treatment for localized dermatitis initiated. Follow-up in 3 months.",
            file_path: "uploads/medical_records/demo_derm_report.pdf",
            file_type: "application/pdf",
            file_size: "1.0 MB"
        },
        {
            name: "COVID-19 Vaccination Certificate",
            record_type: "Immunization",
            doctor_name: "Ministry of Health",
            facility_name: "Sir Ketumile Masire Teaching Hospital",
            date_of_service: "2024-05-20",
            status: "Verified",
            notes: "Booster dose administered.",
            file_path: "uploads/medical_records/demo_vaccine_cert.pdf",
            file_type: "application/pdf",
            file_size: "500 KB"
        }
    ];

    for (const record of records) {
        await client.query(`
            INSERT INTO medical_records 
            (patient_id, name, record_type, doctor_name, facility_name, date_of_service, status, notes, file_path, file_type, file_size)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            patientId,
            record.name,
            record.record_type,
            record.doctor_name,
            record.facility_name,
            record.date_of_service,
            record.status,
            record.notes,
            record.file_path,
            record.file_type,
            record.file_size
        ]);
    }
    console.log(`✅ Seeded ${records.length} medical records.`);
};

const seed = async () => {
    const client = await pool.connect();

    try {
        console.log('🌱 Starting database seed (Botswana Production Grade)...');
        await client.query('BEGIN');

        // --- 1. Clean up existing data ---
        console.log('🧹 Cleaning up old doctor data...');
        // Note: We don't delete all users here to preserve the patient if possible,
        // but if the patient doesn't exist, we can't seed records.
        // Assuming init.sql or manual signup created the patient.

        await client.query(`DELETE FROM doctor_profiles`);
        await client.query(`DELETE FROM users WHERE role = 'doctor'`);

        // --- 2. Define Botswana Specific Doctors ---
        const passwordHash = await bcrypt.hash('password123', 10);

        const doctors = [
            {
                name: 'Dr. Thabo Kgosi',
                email: 'thabo.kgosi@haemilife.com',
                phone: '+267 71 111 222',
                specialization: 'Cardiologist',
                experience: 18,
                fee: 1200.00,
                bio: 'Leading Interventional Cardiologist in Gaborone. Formerly Head of Cardiology at Princess Marina Hospital. Specializes in coronary interventions and heart failure management.',
                license: 'BW-MED-2008-012'
            },
            {
                name: 'Dr. Lorato Molefe',
                email: 'lorato.molefe@haemilife.com',
                phone: '+267 72 333 444',
                specialization: 'Pediatrician',
                experience: 12,
                fee: 850.00,
                bio: 'Compassionate Pediatric Specialist at Bokamoso Private Hospital. Dedicated to neonatal care and early childhood development tracking.',
                license: 'BW-MED-2014-089'
            },
            {
                name: 'Dr. Neo Mousi',
                email: 'neo.mousi@haemilife.com',
                phone: '+267 73 555 666',
                specialization: 'General Practitioner',
                experience: 8,
                fee: 400.00,
                bio: 'Family-focused GP based in Maun. Expert in tropical diseases and travel medicine for the Okavango region. Committed to preventative community health.',
                license: 'BW-MED-2018-156'
            },
            {
                name: 'Dr. Kagiso Dube',
                email: 'kagiso.dube@haemilife.com',
                phone: '+267 74 777 888',
                specialization: 'Dermatologist',
                experience: 15,
                fee: 950.00,
                bio: 'Renowned Dermatologist specializing in sun-related skin conditions and cosmetic dermatology. Runs a specialized clinic in Phakalane.',
                license: 'BW-MED-2011-045'
            },
            {
                name: 'Dr. Mpho Seretse',
                email: 'mpho.seretse@haemilife.com',
                phone: '+267 75 999 000',
                specialization: 'Gynecologist',
                experience: 20,
                fee: 1100.00,
                bio: 'Senior Obstetrician & Gynecologist. Advocate for women\'s reproductive health with extensive experience in high-risk pregnancies at Sir Ketumile Masire Teaching Hospital.',
                license: 'BW-MED-2006-003'
            },
            {
                name: 'Dr. Tshepo Motlhabane',
                email: 'tshepo.mot@haemilife.com',
                phone: '+267 76 123 123',
                specialization: 'Orthopedic Surgeon',
                experience: 14,
                fee: 1500.00,
                bio: 'Sports Medicine specialist and Orthopedic Surgeon. Consultant for Botswana National Sports Commission athletes. Expert in arthroscopic surgery.',
                license: 'BW-MED-2012-234'
            },
            {
                name: 'Dr. Amantle Kwape',
                email: 'amantle.kwape@haemilife.com',
                phone: '+267 77 456 456',
                specialization: 'Neurologist',
                experience: 10,
                fee: 1300.00,
                bio: 'Fellowship-trained Neurologist. Specializes in migraine management, epilepsy, and neuro-degenerative disorders. Practices at Gaborone Private Hospital.',
                license: 'BW-MED-2016-567'
            },
            {
                name: 'Dr. Tumelo Sechele',
                email: 'tumelo.sech@haemilife.com',
                phone: '+267 71 789 789',
                specialization: 'Psychiatrist',
                experience: 16,
                fee: 1000.00,
                bio: 'Holistic Psychiatrist integrating medication management with tele-therapy. Focused on anxiety, depression, and workplace burnout tailored for corporate professionals.',
                license: 'BW-MED-2010-890'
            },
            {
                name: 'Dr. Bakang Ntsima',
                email: 'bakang.n@haemilife.com',
                phone: '+267 72 234 567',
                specialization: 'Ophthalmologist',
                experience: 9,
                fee: 900.00,
                bio: 'Eye specialist with a focus on cataract surgery and diabetic retinopathy. Conducting mobile eye clinics in rural Kweneng districts.',
                license: 'BW-MED-2017-321'
            },
            {
                name: 'Dr. Sethunya Phiri',
                email: 'sethunya.p@haemilife.com',
                phone: '+267 73 876 543',
                specialization: 'Oncologist',
                experience: 22,
                fee: 1400.00,
                bio: 'Leading Clinical Oncologist. Pioneer in Introducing modern immunotherapy treatments to Botswana. Compassionate care for cancer patients.',
                license: 'BW-MED-2004-011'
            },
            {
                name: 'Dr. Kabo Mogwe',
                email: 'kabo.mogwe@haemilife.com',
                phone: '+267 74 543 210',
                specialization: 'Dentist',
                experience: 7,
                fee: 500.00,
                bio: 'Cosmetic and Restorative Dentist. Dedicated to creating confident smiles using the latest digital dentistry technology.',
                license: 'BW-MED-2019-654'
            },
            {
                name: 'Dr. Goitseone Moloi',
                email: 'goitse.moloi@haemilife.com',
                phone: '+267 75 678 901',
                specialization: 'ENT Specialist',
                experience: 11,
                fee: 800.00,
                bio: 'Ear, Nose, and Throat Surgeon. Expert in treating allergic rhinitis and pediatric ENT conditions. Based in Francistown.',
                license: 'BW-MED-2015-432'
            }
        ];

        // --- 3. Execute Insertions ---
        for (const doc of doctors) {
            // Insert User
            // Note: Using 'password' column as per schema forensic audit
            const userRes = await client.query(`
                INSERT INTO users (name, email, password, role, phone_number, is_active)
                VALUES ($1, $2, $3, 'doctor', $4, true)
                RETURNING id
            `, [doc.name, doc.email, passwordHash, doc.phone]);

            const userId = userRes.rows[0].id;

            // Insert Profile
            await client.query(`
                INSERT INTO doctor_profiles (user_id, specialization, license_number, years_of_experience, bio, consultation_fee, is_verified)
                VALUES ($1, $2, $3, $4, $5, $6, true)
            `, [userId, doc.specialization, doc.license, doc.experience, doc.bio, doc.fee]);

            // Optional: Create specific schedule for them if needed later, 
            // but for now, the profile presence allows them to be listed.
            // Let's add a default M-F 08:00-17:00 schedule for all to ensure they are "bookable/available"
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
            for (const day of days) {
                await client.query(`
                    INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available)
                    VALUES ($1, $2, '08:00:00', '17:00:00', true)
                `, [userId, day]);
            }

            console.log(`✅ Created Specialist: ${doc.name} (${doc.specialization})`);
        }

        // --- 4. Seed Medical Records for Default Patient ---
        // --- 4. Seed Medical Records for Default Patient ---
        let patientId;
        const patientRes = await client.query("SELECT id FROM users WHERE email = 'patient@haemilife.com'");

        if (patientRes.rows.length > 0) {
            patientId = patientRes.rows[0].id;
            console.log('🔄 Patient exists, updating password to ensure access...');
            await client.query('UPDATE users SET password = $1 WHERE id = $2', [passwordHash, patientId]);
        } else {
            console.log('⚠️ Patient not found, creating default patient (Tebogo)...');
            const newPatient = await client.query(`
                INSERT INTO users (name, email, password, role, phone_number, id_number, status, is_verified)
                VALUES ($1, $2, $3, 'patient', $4, $5, 'ACTIVE', true)
                RETURNING id
            `, ['Tebogo Motswana', 'patient@haemilife.com', passwordHash, '+26773123456', '123456789']);
            patientId = newPatient.rows[0].id;
            console.log('✅ Created Patient: Tebogo Motswana');
        }

        if (patientId) {
            await seedMedicalRecords(client, patientId);
        }

        await client.query('COMMIT');
        console.log('✨ Botswana Production-Grade Seeding Completed Successfully! 🇧🇼');
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
