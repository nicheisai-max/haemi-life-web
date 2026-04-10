-- =====================================================
-- HAEMI LIFE DATABASE INITIALIZATION (v4.0)
-- "Gateway to Persistence"
-- Synchronized with Platinum Institutional Sync (v10.5)
-- Last updated: 2026-04-06 (Institutional Column Hardening)
-- =====================================================

BEGIN;

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- Required for digest/blind indexing

-- 1.5 Clean Start (Prevent Schema Drift)
-- Non-critical tables can be dropped if schema changed significantly
DROP TABLE IF EXISTS analytics_daily_visits CASCADE;
DROP TABLE IF EXISTS revenue_stats CASCADE;
-- Table 'medical_records' should stay persistent for files
-- DROP TABLE IF EXISTS medical_records CASCADE;
-- DROP TABLE IF EXISTS prescription_items CASCADE;
-- DROP TABLE IF EXISTS prescriptions CASCADE;
-- DROP TABLE IF EXISTS appointments CASCADE;
-- DROP TABLE IF EXISTS pharmacies CASCADE;

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
    initials VARCHAR(4), -- Enterprise-grade user initials
    profile_image VARCHAR(255),
    profile_image_data BYTEA,                          -- Binary storage for uploaded profile pictures
    profile_image_mime VARCHAR(100),                   -- MIME type for profile picture (e.g. image/jpeg)
    last_activity TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- Tracking for session timeout
    phone_blind_index VARCHAR(64),                     -- Searchable hash for encrypted phone
    id_blind_index VARCHAR(64),                        -- Searchable hash for encrypted ID
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ -- ISO 27001 soft-delete support
);

-- User Presence & Session Management (Sliding Window Infrastructure)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_role VARCHAR NOT NULL CHECK (user_role IN ('patient', 'doctor', 'admin', 'pharmacist')),
    session_id VARCHAR UNIQUE NOT NULL,
    access_token_jti VARCHAR,
    refresh_token_jti VARCHAR,
    previous_refresh_token_jti VARCHAR,
    previous_access_token_jti VARCHAR,
    jti_rotated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    device_type VARCHAR,
    browser_name VARCHAR,
    os_name VARCHAR,
    login_method VARCHAR,
    login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    logout_time TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    logout_reason VARCHAR,
    tab_identifier VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS index_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS index_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS index_user_sessions_is_active ON user_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at) WHERE revoked = FALSE;

-- PII Blind Indexing for High-Performance Search
CREATE INDEX IF NOT EXISTS idx_users_phone_blind ON users(phone_blind_index);
CREATE INDEX IF NOT EXISTS idx_users_id_blind ON users(id_blind_index);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

-- 3. Audit Logs (Aligned with Admin & Audit Services)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    actor_role VARCHAR(50),
    action VARCHAR(100) NOT NULL, -- Previously action_type
    entity_type VARCHAR(50), -- Previously target_type or part of metadata
    entity_id UUID, -- Previously target_id
    details JSONB, -- Previously metadata
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Audit Performance Indices
CREATE INDEX IF NOT EXISTS idx_audit_user_action ON audit_logs(user_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- Security Events (Forensic Observability — migration 011)
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    user_role VARCHAR,
    event_type VARCHAR NOT NULL,
    event_category VARCHAR,
    event_severity VARCHAR,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR,
    session_id VARCHAR,
    request_path VARCHAR,
    request_method VARCHAR,
    http_status_code INTEGER,
    event_metadata JSONB,
    is_suspicious BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS index_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS index_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS index_security_events_created_at ON security_events(created_at);

-- Append-Only Immutability (migration 012 — Enterprise Security Violation Guard)
CREATE OR REPLACE FUNCTION enforce_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Enterprise Security Violation: % operations are strictly forbidden on audit and security tables.', TG_OP;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_logs_modification ON audit_logs;
CREATE TRIGGER trg_prevent_audit_logs_modification
BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

DROP TRIGGER IF EXISTS trg_prevent_audit_logs_truncate ON audit_logs;
CREATE TRIGGER trg_prevent_audit_logs_truncate
BEFORE TRUNCATE ON audit_logs FOR EACH STATEMENT EXECUTE FUNCTION enforce_append_only();

DROP TRIGGER IF EXISTS trg_prevent_security_events_modification ON security_events;
CREATE TRIGGER trg_prevent_security_events_modification
BEFORE UPDATE OR DELETE ON security_events FOR EACH ROW EXECUTE FUNCTION enforce_append_only();

DROP TRIGGER IF EXISTS trg_prevent_security_events_truncate ON security_events;
CREATE TRIGGER trg_prevent_security_events_truncate
BEFORE TRUNCATE ON security_events FOR EACH STATEMENT EXECUTE FUNCTION enforce_append_only();

-- Doctor Profiles
CREATE TABLE IF NOT EXISTS doctor_profiles (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    specialization VARCHAR(100),
    license_number VARCHAR(50) UNIQUE,
    years_of_experience INTEGER,
    bio TEXT,
    consultation_fee DECIMAL(10,2) CHECK (consultation_fee >= 0),
    is_verified BOOLEAN DEFAULT false,
    profile_image VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_user_id ON doctor_profiles(user_id);

-- Patient Profiles
CREATE TABLE IF NOT EXISTS patient_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    date_of_birth DATE,
    gender VARCHAR(20),
    blood_group VARCHAR(10),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    allergies TEXT,
    medical_conditions TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_user_id ON patient_profiles(user_id);

-- Pharmacist Profiles
CREATE TABLE IF NOT EXISTS pharmacist_profiles (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    license_number VARCHAR(50) UNIQUE,
    workplace_name VARCHAR(255),
    years_of_experience INTEGER,
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pharmacist_profiles_user_id ON pharmacist_profiles(user_id);

-- Doctor Schedules
CREATE TABLE IF NOT EXISTS doctor_schedules (
    id SERIAL PRIMARY KEY,
    doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL, -- 0 (Sunday) to 6 (Saturday)
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Medications (Master List)
CREATE TABLE IF NOT EXISTS medicines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    strength VARCHAR(100),
    category VARCHAR(100),
    common_uses TEXT,
    price_per_unit DECIMAL(10,2) CHECK (price_per_unit >= 0),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Pharmacies
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    city VARCHAR(100),
    district VARCHAR(100),
    gps_latitude DECIMAL(10,8),
    gps_longitude DECIMAL(11,8),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pharmacies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location_id INTEGER REFERENCES locations(id),
    address TEXT,
    phone_number VARCHAR(50),
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 30 CHECK (duration_minutes > 0),
    status VARCHAR(20) DEFAULT 'scheduled',
    consultation_type VARCHAR(50), -- 'video', 'in-person'
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ -- Soft delete support
);

-- Appointment Performance Indices
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_deleted_at ON appointments(deleted_at);

-- Idempotent Migration: Appointments deleted_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='deleted_at') THEN
        ALTER TABLE appointments ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
END $$;

-- Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
    id SERIAL PRIMARY KEY,
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    appointment_id INTEGER REFERENCES appointments(id),
    prescription_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ -- Soft delete support
);

-- Prescription Performance Indices
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_date ON prescriptions(prescription_date DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_deleted_at ON prescriptions(deleted_at);

-- Idempotent Migration: Prescriptions deleted_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='prescriptions' AND column_name='deleted_at') THEN
        ALTER TABLE prescriptions ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
END $$;

-- Prescription Files (Clinical Artifacts)
CREATE TABLE IF NOT EXISTS prescription_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id INTEGER REFERENCES prescriptions(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_mime TEXT,
    file_name TEXT,
    file_size VARCHAR(50), -- Audit Requirement: NIST-compliant metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_presc_files_presc ON prescription_files(prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_files_deleted_at ON prescription_files(deleted_at);

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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ -- Soft delete support
);
CREATE INDEX IF NOT EXISTS idx_prescription_items_deleted_at ON prescription_items(deleted_at);

-- (prescription_items.deleted_at already defined in CREATE TABLE above)

-- Chat System
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participants_hash VARCHAR(64) UNIQUE, -- Deterministic de-duplication lock
    is_redundant BOOLEAN DEFAULT false,
    last_message_id UUID,
    preview_text TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_role VARCHAR(50),
    content TEXT,
    message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'document'
    status VARCHAR(20) DEFAULT 'sent',
    preview_text TEXT,
    sequence_number BIGINT,
    attachment_type VARCHAR(50), 
    attachment_data BYTEA,         -- Secure binary storage for small attachments
    attachment_mime VARCHAR(100),
    attachment_name VARCHAR(255),
    file_path TEXT,                -- Institutional Path SSOT
    reply_to_id UUID REFERENCES messages(id),
    is_read BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ -- Institutional soft-delete
);

-- Message Threading Indices
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at ON messages(deleted_at);

-- (messages.is_read already defined in CREATE TABLE above)

CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id) WHERE is_read = false;

-- Missing Chat Infrastructure
CREATE TABLE IF NOT EXISTS message_reactions (
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL, -- 'like', 'love', etc.
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id, reaction_type)
);

CREATE TABLE IF NOT EXISTS deleted_messages (
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    deleted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS temp_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data BYTEA, -- Staging buffer (Nullable for Filesystem-first pipeline)
    mime VARCHAR(100),
    name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- Message Attachments (Institutional File Vault — migration 022: file_url removed as SSOT is file_path)
CREATE TABLE IF NOT EXISTS message_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    file_name VARCHAR(255),
    file_extension VARCHAR(20),
    file_category VARCHAR(50) DEFAULT 'other',
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_active ON message_attachments(message_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_message_attachments_deleted_at ON message_attachments(deleted_at);

-- Notifications (Role-Based System)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('success', 'warning', 'info', 'error')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT now(),
    -- v10.0: Entity Links (migration 023)
    message_id UUID,
    conversation_id UUID,
    metadata JSONB DEFAULT '{}',
    received_at TIMESTAMPTZ
);
-- v10.0: Performance Indexes for notification tray
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_message_id ON notifications(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_conversation_id ON notifications(conversation_id) WHERE conversation_id IS NOT NULL;

-- Analytics: Daily Visits (Apple Health Style Data)
CREATE TABLE IF NOT EXISTS analytics_daily_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    visits INT NOT NULL,
    new_users INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics: Revenue Stats
CREATE TABLE IF NOT EXISTS revenue_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month VARCHAR(20) NOT NULL, -- e.g., 'Jan 2026'
    revenue DECIMAL(10, 2) NOT NULL,
    expenses DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medical Records (Documents)
CREATE TABLE IF NOT EXISTS medical_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    record_type VARCHAR(100) NOT NULL, 
    doctor_name VARCHAR(255),
    facility_name VARCHAR(255),
    date_of_service DATE,
    status VARCHAR(50) DEFAULT 'Final', 
    notes TEXT,
    file_path VARCHAR(255) NOT NULL DEFAULT 'DB_ONLY',
    file_data BYTEA, -- Secure binary storage
    file_mime VARCHAR(100),
    file_type VARCHAR(100), -- Legacy column
    file_size VARCHAR(50),
    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- Medical Record Files (Separated Document Pipeline — Platinum v4.0)
CREATE TABLE IF NOT EXISTS medical_record_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id UUID NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_mime TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_rec_att_rid ON medical_record_files(record_id);
CREATE INDEX IF NOT EXISTS idx_medical_record_files_deleted_at ON medical_record_files(deleted_at);

-- High-Performance Clinical Performance Indices
CREATE INDEX IF NOT EXISTS idx_clinical_patient_date ON medical_records(patient_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_date ON prescriptions(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_records_deleted_at ON medical_records(deleted_at);

-- (medical_records.file_data and file_mime already defined in CREATE TABLE above)

-- Telemedicine Consents (Institutional Compliance)
CREATE TABLE IF NOT EXISTS telemedicine_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    is_consented BOOLEAN DEFAULT TRUE, -- Explicit consent state (Google/Meta Grade)
    agreed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    signature_data TEXT, -- D15: Digital signature blob/hash
    ip_address VARCHAR(45),
    user_agent TEXT,
    version VARCHAR(20) DEFAULT 'v1.0'
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
    -- This procedure simulates the application logic for seeding
    -- In a real scenario, the app handles encryption, but for demo seeding:
    INSERT INTO users (
        name, email, phone_number, password, role, id_number, is_verified, profile_image,
        phone_blind_index, id_blind_index
    )
    VALUES (
        p_name, p_email, p_phone, p_password_hash, p_role, p_id_number, true, p_profile_image,
        encode(digest(lower(trim(p_phone)), 'sha256'), 'hex'), -- Simplified blind index for SQL seed
        encode(digest(lower(trim(p_id_number)), 'sha256'), 'hex')
    )
    ON CONFLICT (email) DO UPDATE 
    SET password = EXCLUDED.password,
        name = EXCLUDED.name,
        phone_number = EXCLUDED.phone_number,
        profile_image = EXCLUDED.profile_image,
        phone_blind_index = EXCLUDED.phone_blind_index,
        id_blind_index = EXCLUDED.id_blind_index
    WHERE users.password IS DISTINCT FROM EXCLUDED.password 
       OR users.name IS DISTINCT FROM EXCLUDED.name
       OR users.phone_number IS DISTINCT FROM EXCLUDED.phone_number
       OR users.profile_image IS DISTINCT FROM EXCLUDED.profile_image
       OR users.phone_blind_index IS DISTINCT FROM EXCLUDED.phone_blind_index
       OR users.id_blind_index IS DISTINCT FROM EXCLUDED.id_blind_index;
END;
$$;

-- Function: Generate Initials (Enterprise Grade)
CREATE OR REPLACE FUNCTION fn_generate_initials(p_name TEXT) 
RETURNS TEXT AS $$
DECLARE
    parts TEXT[];
    v_clean_name TEXT;
    v_first TEXT;
    v_last TEXT;
BEGIN
    -- Clean the name (remove titles and extra spaces)
    v_clean_name := trim(regexp_replace(p_name, '^(Dr\.|Dr|Prof\.|Prof|Mr\.|Mr|Mrs\.|Mrs|Ms\.|Ms)\s+', '', 'i'));
    parts := regexp_split_to_array(v_clean_name, '\s+');
    
    IF array_length(parts, 1) = 0 THEN
        RETURN 'U';
    ELSIF array_length(parts, 1) = 1 THEN
        RETURN LEFT(UPPER(parts[1]), 2); -- If single name, take first two letters (e.g. "Admin" -> "AD")
    ELSE
        v_first := LEFT(UPPER(parts[1]), 1);
        v_last := LEFT(UPPER(parts[array_length(parts, 1)]), 1);
        RETURN v_first || v_last;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger Function: Update User Initials
CREATE OR REPLACE FUNCTION fn_update_user_initials()
RETURNS TRIGGER AS $$
BEGIN
    NEW.initials := fn_generate_initials(NEW.name);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: tr_user_initials
DROP TRIGGER IF EXISTS tr_user_initials ON users;
CREATE TRIGGER tr_user_initials
BEFORE INSERT OR UPDATE OF name ON users
FOR EACH ROW
EXECUTE FUNCTION fn_update_user_initials();

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
        INSERT INTO medicines (name, generic_name, strength, category, common_uses, price_per_unit) VALUES
        ('Panado Extra', 'Paracetamol 500mg', '500mg', 'Analgesic', 'Pain relief', 35.00),
        ('Amoxil 500', 'Amoxicillin 500mg', '500mg', 'Antibiotic', 'Infection', 120.00),
        ('Lipitor 20mg', 'Atorvastatin', '20mg', 'Statin', 'Cholesterol', 280.00);
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

    -- Create Schedule for Dr. Mpho (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
    DELETE FROM doctor_schedules WHERE doctor_id = v_doctor_id;
    INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time) VALUES
    (v_doctor_id, 1, '08:00'::TIME, '17:00'::TIME), -- Monday
    (v_doctor_id, 3, '08:00'::TIME, '17:00'::TIME), -- Wednesday
    (v_doctor_id, 5, '08:00'::TIME, '17:00'::TIME); -- Friday

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

    -- 7.5. Seed Clinical Data (Prescriptions & Medical Records)
    DECLARE
        v_presc_id INTEGER;
    BEGIN
        -- Dr. Mpho prescribes for Tebogo
        IF NOT EXISTS (SELECT 1 FROM prescriptions WHERE patient_id = v_patient_id) THEN
            INSERT INTO prescriptions (patient_id, doctor_id, prescription_date, status, notes)
            VALUES (v_patient_id, v_doctor_id, CURRENT_DATE - INTERVAL '2 days', 'pending', 'Standard hypertension management. Patient to monitor blood pressure daily.')
            RETURNING id INTO v_presc_id;

            -- Add items for this prescription
            INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, duration_days, quantity)
            SELECT v_presc_id, id, '20mg', 'Once daily', 30, 30 FROM medicines WHERE name = 'Lipitor 20mg';
            
            INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, duration_days, quantity)
            SELECT v_presc_id, id, '500mg', 'As needed for pain', 7, 20 FROM medicines WHERE name = 'Panado Extra';
        END IF;

        -- Seed Medical Records (Uploaded documents)
        IF NOT EXISTS (SELECT 1 FROM medical_records WHERE patient_id = v_patient_id) THEN
            INSERT INTO medical_records (patient_id, name, record_type, doctor_name, facility_name, date_of_service, status, file_path, file_type, file_size) VALUES
            (v_patient_id, 'Blood_Test_Feb2026.pdf', 'Lab Result', 'Dr. Thabo Sekgwi', 'Princess Marina Hospital', CURRENT_DATE - INTERVAL '5 days', 'Final', 'uploads/medical_records/demo_lab_result.pdf', 'application/pdf', '1.2 MB'),
            (v_patient_id, 'X-Ray_Chest_Jan2026.jpg', 'Radiology', 'Dr. Neo Balopi', 'Gaborone Private Hospital', CURRENT_DATE - INTERVAL '25 days', 'Final', 'uploads/medical_records/demo_xray.jpg', 'image/jpeg', '3.5 MB');
        END IF;
    END;

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

    -- ==========================================
    -- 10. REAL-TIME CHAT DEMO SEEDING
    -- Target: Dr. Mpho Modise vs Patient Tebogo Motswana
    -- ==========================================
    DECLARE
        v_demo_conv_id UUID;
    BEGIN
        -- Check if a conversation between exactly these two IDs already exists to avoid trashing organic tests
        SELECT c.id INTO v_demo_conv_id
        FROM conversations c
        JOIN conversation_participants p1 ON c.id = p1.conversation_id AND p1.user_id = v_patient_id
        JOIN conversation_participants p2 ON c.id = p2.conversation_id AND p2.user_id = v_doctor_id
        GROUP BY c.id
        HAVING COUNT(user_id) = 2; -- Must be exactly 2 participants

        IF v_demo_conv_id IS NULL THEN
            -- Create fresh conversation
            INSERT INTO conversations (id, last_message_at) 
            VALUES (uuid_generate_v4(), NOW() - INTERVAL '1 day') 
            RETURNING id INTO v_demo_conv_id;

            -- Bind the Doctor and Patient
            INSERT INTO conversation_participants (conversation_id, user_id) VALUES 
            (v_demo_conv_id, v_patient_id),
            (v_demo_conv_id, v_doctor_id);

            -- Inject the localized Botswana scenario
            INSERT INTO messages (conversation_id, sender_id, content, is_read, created_at) VALUES
            (v_demo_conv_id, v_patient_id, 'Dumela Ngaka Modise. The lab at Princess Marina Hospital said they uploaded my latest blood test results to the system. Can we review them during our video call tomorrow?', true, NOW() - INTERVAL '1 day 4 hours'),
            (v_demo_conv_id, v_doctor_id, 'Dumela Tebogo. Yes, I have them right here on my dashboard. The good news is your fasting glucose has improved significantly. However, we still need to monitor your cholesterol levels. Are you experiencing any headaches?', true, NOW() - INTERVAL '1 day 2 hours 15 minutes'),
            (v_demo_conv_id, v_patient_id, 'That is a huge relief! No headaches recently, but I am almost out of my regular medication. Can you send an e-prescription to my pharmacy in the CBD?', true, NOW() - INTERVAL '1 day 45 minutes'),
            (v_demo_conv_id, v_doctor_id, 'Absolutely. I will issue a digital prescription alongside the system''s consultation notes immediately after our call. Just remember to log in for our video session at 14:00 today.', true, NOW() - INTERVAL '23 hours'),
            (v_demo_conv_id, v_patient_id, 'Ke a leboga, Doctor. I have the appointment on my schedule. See you then.', false, NOW() - INTERVAL '22 hours 50 minutes');
        END IF;

    -- 11. INSTITUTIONAL BASELINE AUDIT SEEDS (Google-Level Continuity)
    DECLARE
        v_final_admin_id UUID;
    BEGIN
        SELECT id INTO v_final_admin_id FROM users WHERE email = 'admin@haemilife.com';
        IF NOT EXISTS (SELECT 1 FROM audit_logs WHERE action = 'SYSTEM_INIT') THEN
            INSERT INTO audit_logs (user_id, action, details, created_at) VALUES
            (v_final_admin_id, 'SYSTEM_INIT', '{"version": "2.0.0", "status": "Institutional Baseline Established"}', NOW() - INTERVAL '30 days'),
            (v_final_admin_id, 'SCHEMA_HARDENING', '{"type": "UUID_MIGRATION", "scope": "Complete Architecture"}', NOW() - INTERVAL '25 days'),
            (v_final_admin_id, 'SECURITY_HUB_ACTIVATION', '{"feature": "Forensic Observability", "status": "Active"}', NOW() - INTERVAL '20 days'),
            (v_final_admin_id, 'CLINICAL_NETWORK_ESTABLISHED', '{"region": "Botswana", "hospitals": ["Princess Marina", "Bokamoso"]}', NOW() - INTERVAL '15 days'),
            (v_final_admin_id, 'VERIFICATION_AUDIT', '{"verified": true, "audit_id": "BW-MD-AUDIT-2026"}', NOW() - INTERVAL '1 day');
        END IF;
    END;

    EXCEPTION
        WHEN undefined_column THEN
            -- Fallback in case the GROUP BY HAVING COUNT logic hits a schema snag, 
            -- although `COUNT(*)` or similar handles it. Using participant_id might fail if it doesn't exist.
            -- Replacing participant_id check with a safer explicit join count.
            NULL; 
    END;

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
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed default session timeout (1440 minutes = 24 hours)
INSERT INTO system_settings (key, value) 
VALUES 
    ('SESSION_TIMEOUT_MINUTES', '1440'),
    ('JWT_ACCESS_EXPIRY_MINUTES', '15'),
    ('JWT_REFRESH_EXPIRY_DAYS', '7')
ON CONFLICT (key) DO NOTHING;

-- Seeding is now managed by setup-db.ts to ensure dynamic hashing of DEMO_PASSWORD
-- CALL sp_seed_demo_data(...);

-- PRODUCTION HARDENING: DATABASE INDEXING REMEDIATION
-- Target: Clinical Scalability
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id ON medical_records(patient_id);

-- 📚 INSTITUTIONAL ALIGNMENT (MASTERSTROKE — ADDITIVE ONLY)
-- Policy: Zero-Drift baseline for new environments.

-- 1. Real-time Presence Infrastructure
CREATE TABLE IF NOT EXISTS active_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    socket_id VARCHAR(255) NOT NULL,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_active_connections_user_id ON active_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_active_connections_socket_id ON active_connections(socket_id);

-- 2. Pharmacy Commerce & Inventory (Consolidated for v4.0 Platinum)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    pharmacy_id INTEGER REFERENCES pharmacies(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    total_amount NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_patient_id ON orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    medicine_id INTEGER REFERENCES medicines(id),
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

CREATE TABLE IF NOT EXISTS pharmacy_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pharmacy_id INTEGER REFERENCES pharmacies(id) ON DELETE CASCADE,
    medicine_id INTEGER REFERENCES medicines(id) ON DELETE CASCADE,
    price NUMERIC(10,2) DEFAULT 0.00,
    stock_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pharmacy_id, medicine_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_pharmacy_medicine ON pharmacy_inventory(pharmacy_id, medicine_id);

-- 3. Institutional Metadata (Lifecycle Audit)
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knex_migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    batch INTEGER,
    migration_time TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS knex_migrations_lock (
    "index" SERIAL PRIMARY KEY,
    is_locked INTEGER
);

-- 4. Unique Active Thread Index
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_conversation 
ON conversations (participants_hash) 
WHERE (is_redundant = false AND participants_hash IS NOT NULL);

COMMIT;
