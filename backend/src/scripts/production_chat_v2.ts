import { pool } from '../config/db';

const migrate = async () => {
    try {
        console.log('Starting Production Grade Migration (CHAT V2)...');

        // 1. Update conversations table
        console.log('Refactoring conversations table...');
        await pool.query(`
            ALTER TABLE conversations ADD COLUMN IF NOT EXISTS participant_one_id UUID REFERENCES users(id);
            ALTER TABLE conversations ADD COLUMN IF NOT EXISTS participant_two_id UUID REFERENCES users(id);
        `);

        // Attempt to backfill existing 1:1 conversations
        await pool.query(`
            DO $$
            DECLARE
                conv_row RECORD;
            BEGIN
                FOR conv_row IN SELECT id FROM conversations WHERE participant_one_id IS NULL LOOP
                    UPDATE conversations c
                    SET 
                        participant_one_id = (SELECT user_id FROM conversation_participants WHERE conversation_id = conv_row.id LIMIT 1),
                        participant_two_id = (SELECT user_id FROM conversation_participants WHERE conversation_id = conv_row.id OFFSET 1 LIMIT 1)
                    WHERE c.id = conv_row.id;
                END LOOP;
            END $$;
        `);

        // 2. Update messages table
        console.log('Refactoring messages table...');
        await pool.query(`
            ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'text';
            ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
        `);

        // 3. Refine message_reactions
        console.log('Refining message_reactions table...');
        // Check if column exists before rename
        const reactionColCheck = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name='message_reactions' AND column_name='emoji';
        `);
        if (reactionColCheck.rows.length > 0) {
            await pool.query(`ALTER TABLE message_reactions RENAME COLUMN emoji TO reaction_type;`);
        }

        // Add or ensure unique constraint (1 reaction per user per message)
        try {
            await pool.query(`ALTER TABLE message_reactions DROP CONSTRAINT IF EXISTS unique_reaction_per_user;`);
            await pool.query(`ALTER TABLE message_reactions ADD CONSTRAINT unique_message_user_reaction UNIQUE (message_id, user_id);`);
        } catch (e) {
            console.warn('Unique constraint note:', e.message);
        }

        // 4. Create message_attachments
        console.log('Creating message_attachments table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS message_attachments (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
                file_url VARCHAR(255) NOT NULL,
                file_type VARCHAR(50),
                file_size BIGINT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('Production Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
