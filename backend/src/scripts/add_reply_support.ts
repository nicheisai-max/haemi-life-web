import { pool } from '../config/db';

const migrate = async () => {
    try {
        console.log('Adding reply_to_id to messages table...');
        await pool.query(`
            ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;
        `);
        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
