-- 🩺 HAEMI LIFE 
-- PostgreSQL Migration: Enterprise security observability infrastructure
-- Created: 2026-03-04
-- Target: user_sessions, security_events, audit_logs

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CLEAN SLATE FOR NEW TABLES ONLY
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS security_events CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;

-- 1. USER_SESSIONS TABLE
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    user_role VARCHAR NOT NULL CHECK (user_role IN ('patient', 'doctor', 'admin', 'pharmacist')),
    session_id VARCHAR UNIQUE NOT NULL,
    access_token_jti VARCHAR,
    refresh_token_jti VARCHAR,
    ip_address INET,
    user_agent TEXT,
    device_type VARCHAR,
    browser_name VARCHAR,
    os_name VARCHAR,
    login_method VARCHAR,
    login_time TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE,
    logout_time TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    logout_reason VARCHAR,
    tab_identifier VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS index_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS index_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS index_user_sessions_is_active ON user_sessions(is_active) WHERE is_active = TRUE;

-- 2. SECURITY_EVENTS TABLE
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS index_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS index_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS index_security_events_created_at ON security_events(created_at);

-- 3. AUDIT_LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID,
    actor_role VARCHAR,
    action_type VARCHAR NOT NULL,
    target_entity_type VARCHAR,
    target_entity_id UUID,
    change_summary TEXT,
    previous_state JSONB,
    new_state JSONB,
    request_ip INET,
    user_agent TEXT,
    request_id VARCHAR,
    trace_id VARCHAR,
    api_endpoint VARCHAR,
    http_method VARCHAR,
    status VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS index_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS index_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS index_audit_logs_created_at ON audit_logs(created_at);
