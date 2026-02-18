import { pool } from '../config/db';

const migrate = async () => {
    try {
        console.log('Starting migration for Chat Features (Reactions & Delete)...');

        // 1. Create Message Reactions Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS message_reactions (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                emoji VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(message_id, user_id, emoji) -- Prevent duplicate reactions of same type? Or just (message_id, user_id) to allow 1 reaction per user?
                -- Whatsapp allows 1 reaction per message per user. Let's strictly enforce (message_id, user_id) for now to be safe, or just emoji. 
                -- User said "Different kind of emoji", implies typical reaction system. usually 1 per user.
            );
        `);

        // Add unique constraint if not exists (handling re-runs)
        // actually for simplicity let's drop the unique constraint and re-add it 
        // to ensure it is (message_id, user_id) if we want 1 reaction/user, or (message_id, user_id, emoji) if multiple.
        // Standard is 1 reaction per user. 
        try {
            await pool.query(`ALTER TABLE message_reactions ADD CONSTRAINT unique_reaction_per_user UNIQUE (message_id, user_id);`);
        } catch (e) {
            // Ignore if exists
        }

        // 2. Create Deleted Messages Table (for "Delete for me")
        await pool.query(`
            CREATE TABLE IF NOT EXISTS deleted_messages (
                message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (message_id, user_id)
            );
        `);

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
