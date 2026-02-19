-- Create system_settings table if it doesn't exist
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
