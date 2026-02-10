-- =====================================================
-- Production-Ready Seed Data for Haemi Life
-- =====================================================
-- This script populates the database with realistic demo data
-- Run AFTER create-api-tables.sql

-- Clear existing data (optional - comment out for production)
-- TRUNCATE audit_logs, prescription_items, prescriptions, appointments, doctor_schedules, doctor_profiles CASCADE;

-- =====================================================
-- 1. USERS (Patients, Doctors, Admins, Pharmacists)
-- =====================================================

-- Patients (10 realistic Botswana names)
INSERT INTO users (name, phone_number, email, password, role, id_number, is_active, created_at) VALUES
('Thabo Molefe', '71234567', 'thabo.molefe@email.com', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'patient', '123456789', true, NOW() - INTERVAL '6 months'),
('Kgomotso Kgosi', '72345678', 'kgomotso.k@email.com', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'patient', '234567890', true, NOW() - INTERVAL '4 months'),
('Tebogo Gabarone', '73456789', 'tebogo.gab@email.com', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'patient', '345678901', true, NOW() - INTERVAL '3 months'),
('Neo Moeti', '74567890', 'neo.moeti@email.com', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'patient', '456789012', true, NOW() - INTERVAL '2 months'),
('Mpho Seretse', '75678901', 'mpho.s@email.com', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'patient', '567890123', true, NOW() - INTERVAL '1 month'),
('Lesego Mothibi', '76789012', 'lesego.m@email.com', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'patient', '678901234', true, NOW() - INTERVAL '20 days'),
('Kagiso Moloi', '77890123', 'kagiso.moloi@email.com', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'patient', '789012345', true, NOW() - INTERVAL '15 days'),
('Boitumelo Sethibe', '78901234', 'boitumelo.s@email.com', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'patient', '890123456', true, NOW() - INTERVAL '10 days'),
('Kefilwe Ramabu', '79012345', 'kefilwe.r@email.com', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'patient', '901234567', true, NOW() - INTERVAL '5 days'),
('Oratile Mmusi', '70123456', 'oratile.m@email.com', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'patient', '012345678', true, NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- Doctors (5 with realistic specializations)
INSERT INTO users (name, phone_number, email, password, role, id_number, is_active, created_at) VALUES
('Dr. Sarah Mosienyane', '71111111', 'dr.mosienyane@haemilife.health', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'doctor', 'D1234567', true, NOW() - INTERVAL '2 years'),
('Dr. Michael Seretse', '72222222', 'dr.seretse@haemilife.health', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'doctor', 'D2345678', true, NOW() - INTERVAL '18 months'),
('Dr. Grace Mothibatsela', '73333333', 'dr.mothibatsela@haemilife.health', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'doctor', 'D3456789', true, NOW() - INTERVAL '1 year'),
('Dr. Tshepo Kgomo', '74444444', 'dr.kgomo@haemilife.health', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'doctor', 'D4567890', true, NOW() - INTERVAL '8 months'),
('Dr. Lorato Khumo', '75555555', 'dr.khumo@haemilife.health', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'doctor', 'D5678901', true, NOW() - INTERVAL '3 months')
ON CONFLICT DO NOTHING;

-- Admins (2)
INSERT INTO users (name, phone_number, email, password, role, is_active, created_at) VALUES
('Admin Deepak', '76666666', 'admin@haemilife.health', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'admin', true, NOW() - INTERVAL '3 years'),
('System Administrator', '77777777', 'sysadmin@haemilife.health', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'admin', true, NOW() - INTERVAL '3 years')
ON CONFLICT DO NOTHING;

-- Pharmacists (2)
INSERT INTO users (name, phone_number, email, password, role, id_number, is_active, created_at) VALUES
('Pharm. Kabo Mogomotsi', '78888888', 'kabo.pharm@haemilife.health', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'pharmacist', 'P1234567', true, NOW() - INTERVAL '1 year'),
('Pharm. Naledi Setshedi', '79999999', 'naledi.pharm@haemilife.health', '$2b$10$xQZ8j9kZxQZ8j9kZxQZ8jO', 'pharmacist', 'P2345678', true, NOW() - INTERVAL '8 months')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 2. DOCTOR PROFILES
-- =====================================================

INSERT INTO doctor_profiles (user_id, specialization, license_number, years_of_experience, bio, consultation_fee, is_verified, created_at) 
SELECT 
    u.id,
    spec.specialization,
    spec.license,
    spec.experience,
    spec.bio,
    spec.fee,
    spec.verified,
    u.created_at
FROM users u
CROSS JOIN LATERAL (
    VALUES
    ('General Practice', 'BW-GP-001-2022', 15, 'Experienced General Practitioner with focus on family medicine and preventive care. Fluent in English and Setswana.', 250.00, true),
    ('Cardiology', 'BW-CARD-045-2020', 12, 'Board-certified Cardiologist specializing in hypertension and heart disease management. Trained at Princess Marina Hospital.', 450.00, true),
    ('Pediatrics', 'BW-PED-082-2021', 8, 'Dedicated Pediatrician with expertise in child development and immunizations. Passionate about community health.', 300.00, true),
    ('Internal Medicine', 'BW-IM-034-2023', 6, 'Internal Medicine specialist focusing on diabetes, chronic diseases, and geriatric care.', 350.00, true),
    ('Dermatology', 'BW-DERM-019-2024', 3, 'Dermatologist specializing in skin conditions common in Botswana climate. Cosmetic and medical dermatology.', 400.00, false)
) AS spec(specialization, license, experience, bio, fee, verified)
WHERE u.role = 'doctor'
ORDER BY u.created_at
LIMIT 5
ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. DOCTOR SCHEDULES (Monday-Friday, 8AM-5PM)
-- =====================================================

-- Dr. Sarah Mosienyane (ID will be 11) - Mon-Fri 8AM-12PM, 2PM-5PM
WITH doctor_id AS (SELECT id FROM users WHERE email = 'dr.mosienyane@haemilife.health')
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available)
SELECT 
    (SELECT id FROM doctor_id),
    dow,
    time_slot.start_time,
    time_slot.end_time,
    true
FROM generate_series(1, 5) dow
CROSS JOIN (
    VALUES ('08:00'::time, '12:00'::time), ('14:00'::time, '17:00'::time)
) AS time_slot(start_time, end_time)
ON CONFLICT DO NOTHING;

-- Dr. Michael Seretse - Mon-Fri 9AM-1PM, 2PM-6PM
WITH doctor_id AS (SELECT id FROM users WHERE email = 'dr.seretse@haemilife.health')
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available)
SELECT 
    (SELECT id FROM doctor_id),
    dow,
    time_slot.start_time,
    time_slot.end_time,
    true
FROM generate_series(1, 5) dow
CROSS JOIN (
    VALUES ('09:00'::time, '13:00'::time), ('14:00'::time, '18:00'::time)
) AS time_slot(start_time, end_time)
ON CONFLICT DO NOTHING;

-- Dr. Grace Mothibatsela - Mon, Wed, Fri 8AM-4PM
WITH doctor_id AS (SELECT id FROM users WHERE email = 'dr.mothibatsela@haemilife.health')
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available)
SELECT 
    (SELECT id FROM doctor_id),
    dow,
    '08:00'::time,
    '16:00'::time,
    true
FROM unnest(ARRAY[1, 3, 5]) dow
ON CONFLICT DO NOTHING;

-- Dr. Tshepo Kgomo - Tue-Sat 10AM-6PM
WITH doctor_id AS (SELECT id FROM users WHERE email = 'dr.kgomo@haemilife.health')
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available)
SELECT 
    (SELECT id FROM doctor_id),
    dow,
    '10:00'::time,
    '18:00'::time,
    true
FROM generate_series(2, 6) dow
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. APPOINTMENTS (Mix of past, today, and future)
-- =====================================================

-- Helper function to get user ID by phone
DO $$
DECLARE
    patient1 INT := (SELECT id FROM users WHERE phone_number = '71234567');
    patient2 INT := (SELECT id FROM users WHERE phone_number = '72345678');
    patient3 INT := (SELECT id FROM users WHERE phone_number = '73456789');
    patient4 INT := (SELECT id FROM users WHERE phone_number = '74567890');
    doctor1 INT := (SELECT id FROM users WHERE email = 'dr.mosienyane@haemilife.health');
    doctor2 INT := (SELECT id FROM users WHERE email = 'dr.seretse@haemilife.health');
    doctor3 INT := (SELECT id FROM users WHERE email = 'dr.mothibatsela@haemilife.health');
BEGIN

-- Past completed appointments
INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, duration_minutes, status, reason, notes, created_at, updated_at) VALUES
(patient1, doctor1, CURRENT_DATE - 30, '10:00'::time, 30, 'completed', 'General checkup', 'Patient presented with mild hypertension. Prescribed medication.', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
(patient2, doctor2, CURRENT_DATE - 25, '14:00'::time, 45, 'completed', 'Cardiology consultation', 'ECG normal. Continue current medication.', NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
(patient3, doctor3, CURRENT_DATE - 20, '09:00'::time, 30, 'completed', 'Child vaccination', 'Administered routine vaccines. No adverse reactions.', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
(patient1, doctor1, CURRENT_DATE - 15, '11:00'::time, 30, 'completed', 'Follow-up', 'Blood pressure improved. Continue treatment.', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
(patient4, doctor2, CURRENT_DATE - 10, '15:00'::time, 30, 'completed', 'Chest pain evaluation', 'Referred for stress test.', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days');

-- Cancelled appointments
INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, duration_minutes, status, reason, notes, created_at, updated_at) VALUES
(patient2, doctor1, CURRENT_DATE - 5, '10:00'::time, 30, 'cancelled', 'General checkup', 'Patient cancelled due to travel.', NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days');

-- Today's appointments
INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, duration_minutes, status, reason, created_at, updated_at) VALUES
(patient1, doctor1, CURRENT_DATE, '10:00'::time, 30, 'scheduled', 'Blood pressure check', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
(patient2, doctor2, CURRENT_DATE, '14:30'::time, 45, 'scheduled', 'Cardiology follow-up', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days');

-- Future appointments
INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, duration_minutes, status, reason, created_at, updated_at) VALUES
(patient3, doctor3, CURRENT_DATE + 3, '09:00'::time, 30, 'scheduled', '6-month checkup', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(patient4, doctor1, CURRENT_DATE + 5, '11:00'::time, 30, 'scheduled', 'General consultation', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(patient1, doctor2, CURRENT_DATE + 7, '15:00'::time, 45, 'scheduled', 'Stress test results', NOW(), NOW()),
(patient2, doctor3, CURRENT_DATE + 10, '10:00'::time, 30, 'scheduled', 'Vaccination', NOW(), NOW());

END$$;

-- =====================================================
-- 5. PRESCRIPTIONS with Items
-- =====================================================

DO $$
DECLARE
    patient1 INT := (SELECT id FROM users WHERE phone_number = '71234567');
    patient2 INT := (SELECT id FROM users WHERE phone_number = '72345678');
    doctor1 INT := (SELECT id FROM users WHERE email = 'dr.mosienyane@haemilife.health');
    doctor2 INT := (SELECT id FROM users WHERE email = 'dr.seretse@haemilife.health');
    appt1 INT;
    appt2 INT;
    presc1 INT;
    presc2 INT;
    presc3 INT;
    med1 UUID;
    med2 UUID;
    med3 UUID;
BEGIN

-- Get appointment IDs
appt1 := (SELECT id FROM appointments WHERE patient_id = patient1 AND appointment_date = CURRENT_DATE - 30 LIMIT 1);
appt2 := (SELECT id FROM appointments WHERE patient_id = patient2 AND appointment_date = CURRENT_DATE - 25 LIMIT 1);

-- Get medicine IDs
med1 := (SELECT id FROM medicines WHERE name = 'Amlodipine' LIMIT 1);
med2 := (SELECT id FROM medicines WHERE name = 'Metformin' LIMIT 1);
med3 := (SELECT id FROM medicines WHERE name = 'Amoxicillin' LIMIT 1);

-- Prescription 1 (filled)
INSERT INTO prescriptions (patient_id, doctor_id, appointment_id, prescription_date, status, notes, created_at, updated_at)
VALUES (patient1, doctor1, appt1, CURRENT_DATE - 30, 'filled', 'For hypertension management', NOW() - INTERVAL '30 days', NOW() - INTERVAL '25 days')
RETURNING id INTO presc1;

INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, duration_days, quantity, instructions)
VALUES 
(presc1, med1, '5mg', 'Once daily in the morning', 30, 30, 'Take with food. Monitor blood pressure regularly.');

-- Prescription 2 (filled)
INSERT INTO prescriptions (patient_id, doctor_id, appointment_id, prescription_date, status, notes, created_at, updated_at)
VALUES (patient2, doctor2, appt2, CURRENT_DATE - 25, 'filled', 'Diabetes management', NOW() - INTERVAL '25 days', NOW() - INTERVAL '20 days')
RETURNING id INTO presc2;

INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, duration_days, quantity, instructions)
VALUES 
(presc2, med2, '850mg', 'Twice daily with meals', 30, 60, 'Take with breakfast and dinner. Maintain diet plan.');

-- Prescription 3 (pending)
INSERT INTO prescriptions (patient_id, doctor_id, appointment_id, prescription_date, status, notes, created_at, updated_at)
VALUES (patient1, doctor1, NULL, CURRENT_DATE, 'pending', 'Upper respiratory infection', NOW(), NOW())
RETURNING id INTO presc3;

INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, duration_days, quantity, instructions)
VALUES 
(presc3, med3, '500mg', 'Three times daily', 7, 21, 'Complete the full course. Take with water.');

END$$;

-- =====================================================
-- 6. AUDIT LOGS (Admin actions)
-- =====================================================

DO $$
DECLARE
    admin1 INT := (SELECT id FROM users WHERE email = 'admin@haemilife.health');
    doctor4 INT := (SELECT id FROM users WHERE email = 'dr.kgomo@haemilife.health');
    doctor5 INT := (SELECT id FROM users WHERE email = 'dr.khumo@haemilife.health');
BEGIN

INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at) VALUES
(admin1, 'VERIFY_DOCTOR', 'doctor_profile', (SELECT id FROM doctor_profiles WHERE user_id = doctor4), '{"doctor_user_id": ' || doctor4 || ', "verified": true}', NOW() - INTERVAL '7 days'),
(admin1, 'CREATE_USER', 'user', (SELECT id FROM users WHERE phone_number = '70123456'), '{"role": "patient"}', NOW() - INTERVAL '2 days'),
(admin1, 'ACTIVATE_USER', 'user', (SELECT id FROM users WHERE phone_number = '71234567'), '{"is_active": true}', NOW() - INTERVAL '1 day');

END$$;

-- =====================================================
-- Verification Queries (Optional - for testing)
-- =====================================================

-- SELECT COUNT(*) as total_users FROM users;
-- SELECT role, COUNT(*) FROM users GROUP BY role;
-- SELECT COUNT(*) as total_appointments FROM appointments;
-- SELECT status, COUNT(*) FROM appointments GROUP BY status;
-- SELECT COUNT(*) as total_prescriptions FROM prescriptions;
-- SELECT COUNT(*) as verified_doctors FROM doctor_profiles WHERE is_verified = true;
