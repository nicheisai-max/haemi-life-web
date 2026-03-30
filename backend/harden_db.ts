import { pool } from './src/config/db';

async function hardenDatabase() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('--- PHASE 1: DATABASE HARDENING ---');

        // 1. Add file_extension column if not exists
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_attachments' AND column_name='file_extension') THEN
                    ALTER TABLE message_attachments ADD COLUMN file_extension TEXT;
                    RAISE NOTICE 'Added column: file_extension';
                END IF;
            END $$;
        `);

        // 2. Add file_category column if not exists
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_attachments' AND column_name='file_category') THEN
                    ALTER TABLE message_attachments ADD COLUMN file_category TEXT;
                    RAISE NOTICE 'Added column: file_category';
                END IF;
            END $$;
        `);

        // 3. Add index on file_type if not exists
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_msg_att_type ON message_attachments(file_type);
        `);
        console.log('Created index: idx_msg_att_type');

        await client.query('COMMIT');
        console.log('\n--- HARDENING COMPLETE: SUCCESS ---');
        process.exit(0);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('--- HARDENING FAILED: ROLLBACK ---');
        console.error(err);
        process.exit(1);
    } finally {
        client.release();
    }
}

hardenDatabase();
