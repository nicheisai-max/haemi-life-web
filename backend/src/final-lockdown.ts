import { pool } from './config/db';

async function lockdown() {
    console.log('--- PHASE 1: DATABASE INTEGRITY LOCK ---');
    let client;
    try {
        client = await pool.connect();
        
        console.log('🛠 Applying ENUM-level constraint to messages.sender_role...');
        await client.query(`
            ALTER TABLE messages 
            ADD CONSTRAINT check_sender_role 
            CHECK (
                sender_role IN ('patient','doctor','pharmacist') 
                OR sender_role IS NULL
            );
        `);
        
        console.log('🛠 Creating performance index for sender_role...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_messages_sender_role 
            ON messages(sender_role);
        `);
        
        console.log('✅ Integrity lock applied successfully.');
    } catch (err) {
        console.error('❌ Lockdown failed:', err);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

lockdown();
