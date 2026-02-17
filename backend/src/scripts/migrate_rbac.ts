import { pool } from '../config/db';
import { logger } from '../utils/logger';

const migrate = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('Starting RBAC Migration...');

        // 1. Add status ENUM to users if not exists
        // PostgreSQL doesn't support IF NOT EXISTS for ADD COLUMN with ENUM easily in one line without type check
        // We'll just try to add columns and catch errors if they exist, or use safer checks

        // Add token_version
        try {
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;`);
            console.log('Added token_version column');
        } catch (e) {
            console.log('token_version might already exist');
        }

        // Add status and populate from is_active
        try {
            // First check if column exists
            const check = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='status'`);
            if (check.rows.length === 0) {
                await client.query(`ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_DELETION'));`);
                // Sync status with is_active
                await client.query(`UPDATE users SET status = 'INACTIVE' WHERE is_active = false;`);
                console.log('Added status column and synced with is_active');
            } else {
                console.log('status column already exists');
            }
        } catch (e) {
            console.error('Error adding status column', e);
            throw e;
        }

        // Create audit_logs table
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                actor_id UUID,
                actor_role VARCHAR(50),
                action_type VARCHAR(50) NOT NULL,
                target_id UUID,
                metadata JSONB,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created audit_logs table');

        await client.query('COMMIT');
        console.log('Migration completed successfully');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed', e);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
};

migrate();
