import { pool } from '../config/db';
import bcrypt from 'bcrypt';

interface TestUser {
    name: string;
    phone_number: string;
    email: string;
    password: string;
    role: 'patient' | 'doctor' | 'admin' | 'pharmacist';
    id_number?: string;
}

const testUsers: TestUser[] = [
    // Patient
    {
        name: 'John Doe',
        phone_number: '+267 1234 5678',
        email: 'patient@test.com',
        password: 'password123',
        role: 'patient',
        id_number: '123456789',
    },
    // Doctor
    {
        name: 'Dr. Sarah Smith',
        phone_number: '+267 2345 6789',
        email: 'doctor@test.com',
        password: 'password123',
        role: 'doctor',
    },
    // Admin
    {
        name: 'Admin User',
        phone_number: '+267 3456 7890',
        email: 'admin@test.com',
        password: 'password123',
        role: 'admin',
    },
    // Pharmacist
    {
        name: 'Pharmacist Jane',
        phone_number: '+267 4567 8901',
        email: 'pharmacist@test.com',
        password: 'password123',
        role: 'pharmacist',
    },
];

async function seedDatabase() {
    console.log('🌱 Seeding database with test users...\n');

    try {
        for (const user of testUsers) {
            // Check if user already exists
            const existingUser = await pool.query(
                'SELECT * FROM users WHERE email = $1 OR phone_number = $2',
                [user.email, user.phone_number]
            );

            let userId;
            if (existingUser.rows.length > 0) {
                console.log(`⚠️  User already exists: ${user.email}`);
                userId = existingUser.rows[0].id;
            } else {
                // Hash password
                const hashedPassword = await bcrypt.hash(user.password, 10);

                // Insert user
                const result = await pool.query(
                    `INSERT INTO users (
              name, phone_number, email, password, role, id_number, created_at, updated_at, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), true) RETURNING id, email, role`,
                    [
                        user.name,
                        user.phone_number,
                        user.email,
                        hashedPassword,
                        user.role,
                        user.id_number || null,
                    ]
                );
                userId = result.rows[0].id;
                console.log(`✅ Created user: ${user.email} (${user.role}) - ID: ${userId}`);
            }

            // If user is a doctor, ensure a profile exists
            if (user.role === 'doctor') {
                const existingProfile = await pool.query(
                    'SELECT id FROM doctor_profiles WHERE user_id = $1',
                    [userId]
                );

                if (existingProfile.rows.length === 0) {
                    await pool.query(
                        `INSERT INTO doctor_profiles (
                user_id, specialization, years_of_experience, bio, consultation_fee, is_verified, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
                        [userId, 'General Physician', 5, 'Dedicated healthcare professional with 5 years of experience.', 500]
                    );
                    console.log(`   ✨ Created missing doctor profile for ${user.email}`);
                }

                // Ensure schedule exists (wipe and re-add for simplicity in seeding)
                await pool.query('DELETE FROM doctor_schedules WHERE doctor_id = $1', [userId]);
                const days = [1, 2, 3, 4, 5]; // Mon-Fri
                for (const day of days) {
                    await pool.query(
                        `INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available)
               VALUES ($1, $2, '09:00:00', '17:00:00', true)`,
                        [userId, day]
                    );
                }
                console.log(`   📅 Updated/Added default schedule for ${user.email}`);
            }
        }

        console.log('\n✨ Database seeding completed!\n');
        console.log('📋 Test Credentials:');
        console.log('==========================================');
        testUsers.forEach((user) => {
            console.log(`\n${user.role.toUpperCase()}:`);
            console.log(`  Email: ${user.email}`);
            console.log(`  Phone: ${user.phone_number}`);
            console.log(`  Password: ${user.password}`);
        });
        console.log('\n==========================================\n');
    } catch (error) {
        console.error('❌ Error seeding database:', error);
    } finally {
        // Use a local pool for seeding if necessary, but here we use the imported pool.
        // If we close it here, subsequent calls might fail if not handled.
        await pool.end();
    }
}

seedDatabase();
