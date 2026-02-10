-- =====================================================
-- DEMO DATA SEEDING FOR INVESTOR PRESENTATION
-- Botswana-specific realistic data
-- =====================================================

BEGIN;

-- Clear existing demo data (preserve structure)
TRUNCATE TABLE appointments CASCADE;
TRUNCATE TABLE prescriptions CASCADE;
TRUNCATE TABLE doctor_schedules CASCADE;
TRUNCATE TABLE doctors CASCADE;
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE locations CASCADE;
TRUNCATE TABLE medicines CASCADE;
TRUNCATE TABLE pharmacies CASCADE;

-- =====================================================
-- BOTSWANA GEOGRAPHY DATA
-- =====================================================

INSERT INTO locations (city, district, gps_latitude, gps_longitude) VALUES
('Gaborone', 'South-East District', -24.6282, 25.9231),
('Francist

own', 'North-East District', -21.1699, 27.5084),
('Maun', 'North-West District', -19.9945, 23.4163),
('Kasane', 'Chobe District', -17.8122, 25.1530),
('Lobatse', 'South-East District', -25.2166, 25.6833),
('Molepolole', 'Kweneng District', -24.4069, 25.4956),
('Serowe', 'Central District', -22.3833, 26.7167),
('Palapye', 'Central District', -22.5500, 27.1333);

-- =====================================================
-- DEMO USERS (Pre-verified, stable accounts)
-- =====================================================

-- Admin Account
INSERT INTO users (id, name, email, phone_number, password_hash, role, is_active, is_verified) VALUES
('admin-demo-001', 'Admin Kgosi', 'admin@demo.haemi.life', '+267 71234567', 
 '$2b$10$YourHashedPasswordHere', 'admin', true, true);

-- Doctor Accounts (5 specialists)
INSERT INTO users (id, name, email, phone_number, password_hash, role, is_active, is_verified) VALUES
('doctor-demo-001', 'Dr. Mpho Modise', 'dr.mpho@demo.haemi.life', '+267 72123456',
 '$2b$10$YourHashedPasswordHere', 'doctor', true, true),
('doctor-demo-002', 'Dr. Naledi Tsheko', 'dr.naledi@demo.haemi.life', '+267 72234567',
 '$2b$10$YourHashedPasswordHere', 'doctor', true, true),
('doctor-demo-003', 'Dr. Thabo Molefe', 'dr.thabo@demo.haemi.life', '+267 72345678',
 '$2b$10$YourHashedPasswordHere', 'doctor', true, true),
('doctor-demo-004', 'Dr. Keitumetse Dube', 'dr.keitu@demo.haemi.life', '+267 72456789',
 '$2b$10$YourHashedPasswordHere', 'doctor', true, true),
('doctor-demo-005', 'Dr. Gorata Sekgoma', 'dr.gorata@demo.haemi.life', '+267 72567890',
 '$2b$10$YourHashedPasswordHere', 'doctor', true, true);

-- Patient Accounts (10 varied profiles)
INSERT INTO users (id, name, email, phone_number, password_hash, role, is_active, is_verified) VALUES
('patient-demo-001', 'Tebogo Motswana', 'tebogo@demo.haemi.life', '+267 73123456',
 '$2b$10$YourHashedPasswordHere', 'patient', true, true),
('patient-demo-002', 'Lesego Kgosidintsi', 'lesego@demo.haemi.life', '+267 73234567',
 '$2b$10$YourHashedPasswordHere', 'patient', true, true),
('patient-demo-003', 'Kagiso Moalusi', 'kagiso@demo.haemi.life', '+267 73345678',
 '$2b$10$YourHashedPasswordHere', 'patient', true, true),
('patient-demo-004', 'Neo Seretse', 'neo@demo.haemi.life', '+267 73456789',
 '$2b$10$YourHashedPasswordHere', 'patient', true, true),
('patient-demo-005', 'Tshepo Mabote', 'tshepo@demo.haemi.life', '+267 73567890',
 '$2b$10$YourHashedPasswordHere', 'patient', true, true),
('patient-demo-006', 'Boitumelo Kgari', 'boitu@demo.haemi.life', '+267 73678901',
 '$2b$10$YourHashedPasswordHere', 'patient', true, true),
('patient-demo-007', 'Onalenna Ramahobo', 'ona@demo.haemi.life', '+267 73789012',
 '$2b$10$YourHashedPasswordHere', 'patient', true, true),
('patient-demo-008', 'Kitso Mosimanegape', 'kitso@demo.haemi.life', '+267 73890123',
 '$2b$10$YourHashedPasswordHere', 'patient', true, true),
('patient-demo-009', 'Lorato Gabaitse', 'lorato@demo.haemi.life', '+267 73901234',
 '$2b$10$YourHashedPasswordHere', 'patient', true, true),
('patient-demo-010', 'Keletso Moremi', 'keletso@demo.haemi.life', '+267 74012345',
 '$2b$10$YourHashedPasswordHere', 'patient', true, true);

-- Pharmacist Accounts (2)
INSERT INTO users (id, name, email, phone_number, password_hash, role, is_active, is_verified) VALUES
('pharmacist-demo-001', 'Keitumetse Gaosekwe', 'keitu.pharm@demo.haemi.life', '+267 75123456',
 '$2b$10$YourHashedPasswordHere', 'pharmacist', true, true),
('pharmacist-demo-002', 'Mmoloki Sesinyi', 'mmoloki@demo.haemi.life', '+267 75234567',
 '$2b$10$YourHashedPasswordHere', 'pharmacist', true, true);

-- =====================================================
-- DOCTOR PROFILES
-- =====================================================

INSERT INTO doctors (user_id, specialization, license_number, years_of_experience, consultation_fee, bio, profile_image) VALUES
('doctor-demo-001', 'General Practitioner', 'BW-GP-2018-1234', 6, 250.00,
 'Experienced general practitioner with a passion for community health. Fluent in English and Setswana.',
 '/images/doctors/doctor_01.jpg'),
('doctor-demo-002', 'Pediatrician', 'BW-PED-2019-5678', 5, 300.00,
 'Child health specialist focused on preventive care and early childhood development.',
 '/images/doctors/doctor_02.jpg'),
('doctor-demo-003', 'Cardiologist', 'BW-CARD-2015-9012', 9, 450.00,
 'Heart specialist with training from University of Botswana and abroad.',
 '/images/doctors/doctor_03.jpg'),
('doctor-demo-004', 'Dermatologist', 'BW-DERM-2020-3456', 4, 350.00,
 'Skin care expert specializing in tropical dermatology and cosmetic procedures.',
 '/images/doctors/doctor_04.jpg'),
('doctor-demo-005', 'Gynecologist', 'BW-GYN-2017-7890', 7, 400.00,
 'Women''s health specialist providing comprehensive reproductive healthcare.',
 '/images/doctors/doctor_05.jpg');

-- =====================================================
-- DOCTOR SCHEDULES (Realistic availability)
-- =====================================================

-- Dr. Mpho - Mon, Wed, Fri
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available) VALUES
('doctor-demo-001', 'monday', '08:00', '17:00', true),
('doctor-demo-001', 'wednesday', '08:00', '17:00', true),
('doctor-demo-001', 'friday', '08:00', '17:00', true);

-- Dr. Naledi - Tue, Thu, Sat
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available) VALUES
('doctor-demo-002', 'tuesday', '09:00', '16:00', true),
('doctor-demo-002', 'thursday', '09:00', '16:00', true),
('doctor-demo-002', 'saturday', '09:00', '13:00', true);

-- Dr. Thabo - Mon-Fri
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available) VALUES
('doctor-demo-003', 'monday', '10:00', '18:00', true),
('doctor-demo-003', 'tuesday', '10:00', '18:00', true),
('doctor-demo-003', 'wednesday', '10:00', '18:00', true),
('doctor-demo-003', 'thursday', '10:00', '18:00', true),
('doctor-demo-003', 'friday', '10:00', '18:00', true);

-- Dr. Keitumetse - Tue, Wed, Thu
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available) VALUES
('doctor-demo-004', 'tuesday', '08:30', '16:30', true),
('doctor-demo-004', 'wednesday', '08:30', '16:30', true),
('doctor-demo-004', 'thursday', '08:30', '16:30', true);

-- Dr. Gorata - Mon, Wed, Fri, Sat
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, is_available) VALUES
('doctor-demo-005', 'monday', '09:00', '17:00', true),
('doctor-demo-005', 'wednesday', '09:00', '17:00', true),
('doctor-demo-005', 'friday', '09:00', '17:00', true),
('doctor-demo-005', 'saturday', '10:00', '14:00', true);

-- =====================================================
-- MEDICINES (Common Botswana medications)
-- =====================================================

INSERT INTO medicines (name, generic_name, common_uses, price_per_unit) VALUES
('Panado Extra', 'Paracetamol 500mg', 'Pain relief, fever reduction', 35.00),
('Amoxil 500', 'Amoxicillin 500mg', 'Bacterial infections', 120.00),
('Ventolin Inhaler', 'Salbutamol', 'Asthma, bronchospasm', 95.00),
('Lipitor 20mg', 'Atorvastatin', 'High cholesterol', 280.00),
('Metformin 500mg', 'Metformin', 'Type 2 diabetes', 65.00),
('Losec 20mg', 'Omeprazole', 'Acid reflux, ulcers', 145.00),
('Allergex', 'Chlorpheniramine', 'Allergies, hay fever', 42.00),
('Ibuprofen 400mg', 'Ibuprofen', 'Pain, inflammation', 28.00),
('Cipro 500mg', 'Ciprofloxacin', 'Bacterial infections', 180.00),
('Piriton', 'Chlorpheniramine 4mg', 'Allergic reactions', 38.00);

-- =====================================================
-- PHARMACIES (Botswana locations)
-- =====================================================

INSERT INTO pharmacies (name, location_id, address, phone_number, email) VALUES
('Clicks Pharmacy Gaborone', 1, 'Riverwalk Mall, Gaborone', '+267 3901234', 'gaborone@clicks.co.bw'),
('Dis-Chem Francistown', 2, 'Nzano Centre, Francistown', '+267 2412345', 'francistown@dischem.co.bw'),
('Botswana Pharmacy Maun', 3, 'Maun Mall, Maun', '+267 6862345', 'maun@bwpharmacy.co.bw'),
('Kasane Pharmacy', 4, 'Main Road, Kasane', '+267 6253456', 'kasane@pharmacy.co.bw');

-- =====================================================
-- REALISTIC APPOINTMENT HISTORY (Past 3 months)
-- =====================================================

-- Tebogo's appointments (frequent user)
INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status, consultation_type, reason) VALUES
('patient-demo-001', 'doctor-demo-001', '2026-01-15', '10:00', 'completed', 'video', 'General checkup'),
('patient-demo-001', 'doctor-demo-002', '2026-02-01', '14:00', 'completed', 'in-person', 'Child vaccination'),
('patient-demo-001', 'doctor-demo-001', '2026-02-20', '11:30', 'upcoming', 'video', 'Follow-up consultation');

-- Lesego's appointments (moderate usage)
INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status, consultation_type, reason) VALUES
('patient-demo-002', 'doctor-demo-003', '2026-01-22', '15:00', 'completed', 'video', 'Blood pressure check'),
('patient-demo-002', 'doctor-demo-003', '2026-02-18', '09:00', 'upcoming', 'in-person', 'Cardiology follow-up');

-- Kagiso's appointments (new user)
INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status, consultation_type, reason) VALUES
('patient-demo-003', 'doctor-demo-004', '2026-02-10', '13:00', 'upcoming', 'video', 'Skin consultation');

-- Neo's appointments
INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status, consultation_type, reason) VALUES
('patient-demo-004', 'doctor-demo-005', '2026-01-05', '10:30', 'completed', 'in-person', 'Annual exam'),
('patient-demo-004', 'doctor-demo-005', '2026-01-28', '11:00', 'completed', 'video', 'Prenatal checkup');

-- More varied appointments
INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status, consultation_type, reason) VALUES
('patient-demo-005', 'doctor-demo-001', '2025-12-20', 'completed', '09:00', 'in-person', 'Flu symptoms'),
('patient-demo-006', 'doctor-demo-002', '2026-01-12', 'completed', '14:30', 'video', 'Child health'),
('patient-demo-007', 'doctor-demo-004', '2026-02-05', 'completed', '10:00', 'video', 'Acne treatment'),
('patient-demo-008', 'doctor-demo-003', '2026-01-18', 'completed', '16:00', 'in-person', 'Heart palpitations'),
('patient-demo-009', 'doctor-demo-005', '2026-02-08', 'upcoming', '15:00', 'video', 'Family planning');

-- =====================================================
-- PRESCRIPTIONS (Linked to appointments)
-- =====================================================

INSERT INTO prescriptions (appointment_id, medicine_id, dosage, frequency, duration_days, instructions, status) VALUES
(1, 1, '500mg', 'Twice daily', 7, 'Take after meals', 'active'),
(1, 3, '2 puffs', 'As needed', 30, 'Use during breathing difficulty', 'active'),
(2, 2, '500mg', 'Three times daily', 10, 'Complete full course', 'filled'),
(3, 7, '1 tablet', 'Once daily', 14, 'Take at bedtime', 'active'),
(4, 4, '20mg', 'Once daily', 90, 'Take in the evening', 'filled'),
(5, 5, '500mg', 'Twice daily', 90, 'Take with meals', 'filled'),
(7, 6, '20mg', 'Once daily', 30, 'Take before breakfast', 'active'),
(8, 1, '500mg', 'As needed', 5, 'For fever or pain', 'filled'),
(9, 9, '500mg', 'Twice daily', 7, 'Drink plenty of water', 'active');

COMMIT;

-- =====================================================
-- DEMO CREDENTIALS (Plain text for reference)
-- Password for all demo accounts: Demo@2026
-- Hash: $2b$10$[generated hash]
-- =====================================================
