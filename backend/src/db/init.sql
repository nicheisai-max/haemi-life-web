-- =====================================================
-- HAEMI LIFE DATABASE INITIALIZATION (v2.0)
-- "Gateway to Persistence"
-- =====================================================

BEGIN;

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1.5 Clean Start (Prevent Schema Drift)
-- Non-critical tables can be dropped if schema changed significantly
DROP TABLE IF EXISTS analytics_daily_visits CASCADE;
DROP TABLE IF EXISTS revenue_stats CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
-- Table 'medical_records' should stay persistent for files
DROP TABLE IF EXISTS medical_records CASCADE;
DROP TABLE IF EXISTS prescription_items CASCADE;

DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS pharmacies CASCADE;

-- CRITICAL TABLES: DO NOT DROP (Ensures persistent users and core data)
-- DROP TABLE IF EXISTS locations CASCADE;
-- DROP TABLE IF EXISTS medicines CASCADE;
-- DROP TABLE IF EXISTS doctor_schedules CASCADE;
-- DROP TABLE IF EXISTS doctor_profiles CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- 2. Schema Definitions (Tables)

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- Will be renamed to password_hash in v3
    role VARCHAR(50) NOT NULL CHECK (role IN ('patient', 'doctor', 'admin', 'pharmacist')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_DELETION')),
    token_version INTEGER DEFAULT 0,
    id_number VARCHAR(50),
    is_active BOOLEAN DEFAULT true, -- Deprecated, use status
    is_verified BOOLEAN DEFAULT false,
    profile_image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schema Migration (Ensure column exists for existing DBs - Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profile_image') THEN
        ALTER TABLE users ADD COLUMN profile_image VARCHAR(255);
    END IF;
END $$;

-- Audit Logs (Compulsory for Compliance)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID, -- Nullable if system action or failed login
    actor_role VARCHAR(50),
    action_type VARCHAR(50) NOT NULL, -- LOGIN, LOGOUT, VIEW_DASHBOARD, UPDATE_PROFILE, etc.
    target_id UUID,
    metadata JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Doctor Profiles
CREATE TABLE IF NOT EXISTS doctor_profiles (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    specialization VARCHAR(100),
    license_number VARCHAR(50) UNIQUE,
    years_of_experience INTEGER,
    bio TEXT,
    consultation_fee DECIMAL(10,2),
    is_verified BOOLEAN DEFAULT false,
    profile_image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Doctor Schedules
CREATE TABLE IF NOT EXISTS doctor_schedules (
    id SERIAL PRIMARY KEY,
    doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    day_of_week VARCHAR(20) NOT NULL, -- Changed from INTEGER to VARCHAR to match seed data ('monday', etc.)
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medications (Master List)
CREATE TABLE IF NOT EXISTS medicines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    common_uses TEXT,
    price_per_unit DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pharmacies
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    city VARCHAR(100),
    district VARCHAR(100),
    gps_latitude DECIMAL(10,8),
    gps_longitude DECIMAL(11,8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pharmacies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location_id INTEGER REFERENCES locations(id),
    address TEXT,
    phone_number VARCHAR(50),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    status VARCHAR(20) DEFAULT 'scheduled',
    consultation_type VARCHAR(50), -- 'video', 'in-person'
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
    id SERIAL PRIMARY KEY,
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    appointment_id INTEGER REFERENCES appointments(id),
    prescription_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prescription Items
CREATE TABLE IF NOT EXISTS prescription_items (
    id SERIAL PRIMARY KEY,
    prescription_id INTEGER REFERENCES prescriptions(id) ON DELETE CASCADE,
    medicine_id INTEGER REFERENCES medicines(id),
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    duration_days INTEGER,
    quantity INTEGER,
    instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat System
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT,
    attachment_url VARCHAR(255),
    attachment_type VARCHAR(50), -- 'image', 'pdf', 'document'
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications (Role-Based System)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('success', 'warning', 'info', 'error')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics: Daily Visits (Apple Health Style Data)
CREATE TABLE IF NOT EXISTS analytics_daily_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    visits INT NOT NULL,
    new_users INT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Analytics: Revenue Stats
CREATE TABLE IF NOT EXISTS revenue_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month VARCHAR(20) NOT NULL, -- e.g., 'Jan 2026'
    revenue DECIMAL(10, 2) NOT NULL,
    expenses DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Medical Records (Documents)
CREATE TABLE IF NOT EXISTS medical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    record_type VARCHAR(100) NOT NULL, -- e.g. 'Lab Result', 'Prescription', 'Radiology'
    doctor_name VARCHAR(255),
    facility_name VARCHAR(255),
    date_of_service DATE,
    status VARCHAR(50) DEFAULT 'Final', -- 'Preliminary', 'Final', 'Amended'
    notes TEXT,
    file_path VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size VARCHAR(50),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 3. Stored Procedures (The "Golden Path" Logic)

-- Procedure: Create User (Safe & Idempotent)
CREATE OR REPLACE PROCEDURE sp_create_user(
    p_name VARCHAR,
    p_email VARCHAR,
    p_phone VARCHAR,
    p_password_hash VARCHAR,
    p_role VARCHAR,
    p_id_number VARCHAR DEFAULT NULL,
    p_profile_image VARCHAR DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO users (name, email, phone_number, password, role, id_number, is_verified, profile_image)
    VALUES (p_name, p_email, p_phone, p_password_hash, p_role, p_id_number, true, p_profile_image)
    ON CONFLICT (email) DO UPDATE 
    SET password = EXCLUDED.password,
        name = EXCLUDED.name,
        phone_number = EXCLUDED.phone_number,
        profile_image = EXCLUDED.profile_image
    WHERE users.password IS DISTINCT FROM EXCLUDED.password 
       OR users.name IS DISTINCT FROM EXCLUDED.name
       OR users.phone_number IS DISTINCT FROM EXCLUDED.phone_number
       OR users.profile_image IS DISTINCT FROM EXCLUDED.profile_image;
END;
$$;

-- Procedure: Seed Demo Data (The Master Switch)
CREATE OR REPLACE PROCEDURE sp_seed_demo_data(p_password_hash VARCHAR)
LANGUAGE plpgsql
AS $$
DECLARE
    v_doctor_id UUID;
    v_patient_id UUID;
    v_pharmacy_loc_id INTEGER;
BEGIN
    -- 1. Create Core Locations (if empty)
    IF NOT EXISTS (SELECT 1 FROM locations LIMIT 1) THEN
        INSERT INTO locations (city, district, gps_latitude, gps_longitude) VALUES
        ('Gaborone', 'South-East', -24.6282, 25.9231),
        ('Francistown', 'North-East', -21.1699, 27.5084),
        ('Maun', 'North-West', -19.9945, 23.4163),
        ('Lobatse', 'South-East', -25.2163, 25.6749),
        ('Serowe', 'Central', -22.3833, 26.7167),
        ('Molepolole', 'Kweneng', -24.4106, 25.4984),
        ('Kasane', 'Chobe', -17.8167, 25.1500);
    END IF;

    -- 2. Create Medicines (if empty)
    IF NOT EXISTS (SELECT 1 FROM medicines LIMIT 1) THEN
        INSERT INTO medicines (name, generic_name, common_uses, price_per_unit) VALUES
        ('Panado Extra', 'Paracetamol 500mg', 'Pain relief', 35.00),
        ('Amoxil 500', 'Amoxicillin 500mg', 'Infection', 120.00),
        ('Lipitor 20mg', 'Atorvastatin', 'Cholesterol', 280.00);
    END IF;

    -- 3. Create Admin User
    CALL sp_create_user('Admin Kgosi', 'admin@haemilife.com', '+26771234567', p_password_hash, 'admin', NULL, '/uploads/admin/admin.png');

    -- 4. Create Specialists (The Advanced Medical Network)
    -- Dr. Thabo (Cardiologist - Gaborone)
    CALL sp_create_user('Dr. Thabo Sekgwi', 'thabo.sekgwi@haemilife.com', '+26771000001', p_password_hash, 'doctor', NULL, '/uploads/doctors/doctor_01.jpg');
    SELECT id INTO v_doctor_id FROM users WHERE email = 'thabo.sekgwi@haemilife.com';
    INSERT INTO doctor_profiles (user_id, specialization, license_number, years_of_experience, bio, consultation_fee, is_verified)
    VALUES (v_doctor_id, 'Cardiologist', 'BW-MD-2010-0982', 15, 'Lead cardiologist specializing in interventional procedures. 15 years experience at Princess Marina Hospital.', 450.00, true)
    ON CONFLICT (user_id) DO NOTHING;

    -- Dr. Lerato (Pediatrician - Maun)
    CALL sp_create_user('Dr. Lerato Molefe', 'lerato.molefe@haemilife.com', '+26771000002', p_password_hash, 'doctor', NULL, '/uploads/doctors/doctor_02.png');
    SELECT id INTO v_doctor_id FROM users WHERE email = 'lerato.molefe@haemilife.com';
    INSERT INTO doctor_profiles (user_id, specialization, license_number, years_of_experience, bio, consultation_fee, is_verified)
    VALUES (v_doctor_id, 'Pediatrician', 'BW-MD-2015-1123', 8, 'Dedicated pediatrician serving the North-West community. Resident doctor at Letsholathebe II Memorial.', 350.00, true)
    ON CONFLICT (user_id) DO NOTHING;

    -- Dr. Kagiso (Psychiatrist - Francistown)
    CALL sp_create_user('Dr. Kagiso Dube', 'kagiso.dube@haemilife.com', '+26771000003', p_password_hash, 'doctor', NULL, NULL);
    SELECT id INTO v_doctor_id FROM users WHERE email = 'kagiso.dube@haemilife.com';
    INSERT INTO doctor_profiles (user_id, specialization, license_number, years_of_experience, bio, consultation_fee, is_verified)
    VALUES (v_doctor_id, 'Psychiatrist', 'BW-MD-2012-4432', 12, 'Mental health advocate specializing in adult psychiatry and CBT.', 400.00, true)
    ON CONFLICT (user_id) DO NOTHING;

    -- Dr. Neo (Obstetrician - Kasane)
    CALL sp_create_user('Dr. Neo Balopi', 'neo.balopi@haemilife.com', '+26771000004', p_password_hash, 'doctor', NULL, '/uploads/doctors/doctor_03.png');
    SELECT id INTO v_doctor_id FROM users WHERE email = 'neo.balopi@haemilife.com';
    INSERT INTO doctor_profiles (user_id, specialization, license_number, years_of_experience, bio, consultation_fee, is_verified)
    VALUES (v_doctor_id, 'Obstetrician', 'BW-MD-2018-7762', 6, 'Providing comprehensive maternal healthcare in the Chobe region.', 300.00, true)
    ON CONFLICT (user_id) DO NOTHING;

    -- Dr. Mpho (Existing General Practitioner - Gaborone)
    CALL sp_create_user('Dr. Mpho Modise', 'doctor@haemilife.com', '+26772123456', p_password_hash, 'doctor', NULL, '/uploads/doctors/doctor_01.jpg');
    SELECT id INTO v_doctor_id FROM users WHERE email = 'doctor@haemilife.com';
    INSERT INTO doctor_profiles (user_id, specialization, license_number, years_of_experience, consultation_fee, is_verified, bio)
    VALUES (v_doctor_id, 'General Practitioner', 'BW-GP-2018-1234', 6, 250.00, true, 'Senior GP focused on family medicine and preventive care.')
    ON CONFLICT (user_id) DO NOTHING;

    -- Create Schedule for Dr. Mpho
    DELETE FROM doctor_schedules WHERE doctor_id = v_doctor_id;
    INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time) VALUES
    (v_doctor_id, 'monday', '08:00'::TIME, '17:00'::TIME),
    (v_doctor_id, 'wednesday', '08:00'::TIME, '17:00'::TIME),
    (v_doctor_id, 'friday', '08:00'::TIME, '17:00'::TIME);

    -- 5. Create Pharmacist (Keitumetse)
    CALL sp_create_user('Keitumetse Gaosekwe', 'pharmacist@haemilife.com', '+26775123456', p_password_hash, 'pharmacist', NULL, '/uploads/pharmacies/pharmacy_01.jpg');

    -- 6. Create Patient (Tebogo)
    CALL sp_create_user('Tebogo Motswana', 'patient@haemilife.com', '+26773123456', p_password_hash, 'patient', '123456789', '/uploads/patients/patient_01.jpg');
    SELECT id INTO v_patient_id FROM users WHERE email = 'patient@haemilife.com';

    -- 7. Create Appointment
    IF NOT EXISTS (SELECT 1 FROM appointments WHERE patient_id = v_patient_id AND appointment_date = CURRENT_DATE) THEN
        INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status, consultation_type, reason)
        VALUES (
            v_patient_id,
            v_doctor_id,
            CURRENT_DATE,
            '14:00'::TIME,
            'scheduled',
            'video',
            'Follow-up Consultation'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM appointments WHERE patient_id = v_patient_id AND appointment_date = (CURRENT_DATE + INTERVAL '2 days')::DATE) THEN
        INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status, consultation_type, reason)
        VALUES (
            v_patient_id,
            v_doctor_id,
            (CURRENT_DATE + INTERVAL '2 days')::DATE,
            '10:00'::TIME,
            'scheduled',
            'video',
            'General Checkup'
        );
    END IF;

    -- 8. Seed Analytics
    IF NOT EXISTS (SELECT 1 FROM analytics_daily_visits LIMIT 1) THEN
        INSERT INTO analytics_daily_visits (date, visits, new_users) VALUES
        (CURRENT_DATE - INTERVAL '6 days', 320, 15),
        (CURRENT_DATE - INTERVAL '5 days', 450, 22),
        (CURRENT_DATE - INTERVAL '4 days', 380, 18),
        (CURRENT_DATE - INTERVAL '3 days', 520, 28),
        (CURRENT_DATE - INTERVAL '2 days', 590, 35),
        (CURRENT_DATE - INTERVAL '1 day', 650, 42),
        (CURRENT_DATE, 720, 45);
    END IF;

    -- 9. Seed Notifications (Role Specific)
    -- 9a. Doctor Notifications
    IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = v_doctor_id) THEN
        INSERT INTO notifications (user_id, title, description, type, created_at) VALUES
        (v_doctor_id, 'Critical Lab Result', 'Patient Kagiso Moalusi: HbA1c levels critical (9.2%). Action required.', 'warning', NOW() - INTERVAL '10 minutes'),
        (v_doctor_id, 'New Appointment Request', 'Neo Dube (Francistown) requested a video consultation for tomorrow.', 'info', NOW() - INTERVAL '1 hour'),
        (v_doctor_id, 'System Update', 'Botswana Essential Drug List (BEDL) updated successfully.', 'success', NOW() - INTERVAL '3 hours');
    END IF;

    -- 9b. Pharmacist Notifications
    DECLARE
        v_pharmacist_id UUID;
    BEGIN
        SELECT id INTO v_pharmacist_id FROM users WHERE email = 'pharmacist@haemilife.com';
        IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = v_pharmacist_id) THEN
            INSERT INTO notifications (user_id, title, description, type, created_at) VALUES
            (v_pharmacist_id, 'New E-Prescription', 'Dr. Thabo Molefe sent a prescription for Amoxil 500mg.', 'info', NOW() - INTERVAL '5 minutes'),
            (v_pharmacist_id, 'Stock Alert: Panado', 'Inventory low at Gaborone North branch. 15 units remaining.', 'warning', NOW() - INTERVAL '2 hours'),
            (v_pharmacist_id, 'Regulatory Sync', 'BOMRA compliance audit scheduled for next Tuesday.', 'info', NOW() - INTERVAL '1 day');
        END IF;
    END;

    -- 9c. Patient Notifications
    IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = v_patient_id) THEN
        INSERT INTO notifications (user_id, title, description, type, created_at) VALUES
        (v_patient_id, 'Appointment Reminder', 'Video consultation with Dr. Mpho Modise is in 2 days.', 'info', NOW() - INTERVAL '30 minutes'),
        (v_patient_id, 'Lab Results Ready', 'Your blood test results from Princess Marina Hospital are available.', 'success', NOW() - INTERVAL '4 hours'),
        (v_patient_id, 'Health Tip: Heatwave', 'Gaborone temperatures to reach 38°C. Stay hydrated.', 'info', NOW() - INTERVAL '1 day');
    END IF;

    -- 9d. Admin Notifications
    DECLARE
        v_admin_id UUID;
    BEGIN
        SELECT id INTO v_admin_id FROM users WHERE email = 'admin@haemilife.com';
        IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = v_admin_id) THEN
            INSERT INTO notifications (user_id, title, description, type, created_at) VALUES
            (v_admin_id, 'System Health Alert', 'Infrastructure monitoring: Gaborone Data Center is running at 92% capacity.', 'warning', NOW() - INTERVAL '15 minutes'),
            (v_admin_id, 'New Doctor Verification', 'Dr. Neo Balopi (Kasane) has submitted documents for verification.', 'info', NOW() - INTERVAL '2 hours');
        END IF;
    END;

    -- 8e. Doctor Notifications (Dr. Mpho) extra
    IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = v_doctor_id AND title = 'Patient Feedback') THEN
        INSERT INTO notifications (user_id, title, description, type, created_at) VALUES
        (v_doctor_id, 'Patient Feedback', 'Tebogo Motswana rated your last consultation 5 stars.', 'success', NOW() - INTERVAL '5 hours');
    END IF;

END;
$$;

-- Trigger to add Welcome Notifications for any newly signed up user
CREATE OR REPLACE FUNCTION fn_on_user_signup()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (user_id, title, description, type)
    VALUES (NEW.id, 'Welcome to Haemi Life!', 'Your healthcare gateway to Botswana is now active. Explore your dashboard.', 'success');
    
    INSERT INTO notifications (user_id, title, description, type)
    VALUES (NEW.id, 'Security Notification', 'Please ensure your profile is updated for accurate medical records.', 'info');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_user_signup_notification ON users;
CREATE TRIGGER tr_user_signup_notification
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION fn_on_user_signup();

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default session timeout (60 minutes)
INSERT INTO system_settings (key, value) 
VALUES ('SESSION_TIMEOUT_MINUTES', '60')
ON CONFLICT (key) DO NOTHING;

COMMIT;
