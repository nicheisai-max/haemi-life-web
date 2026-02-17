import { pool } from '../config/db';
import bcrypt from 'bcrypt';

const seed = async () => {
    const client = await pool.connect();

    try {
        console.log('🌱 Starting database seed (Botswana Production Grade)...');
        await client.query('BEGIN');

        // --- 1. Clean up existing data ---
        console.log('🧹 Cleaning up old doctor data...');
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
