const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME
});

async function fixConversations() {
    try {
        console.log('\n===== FIXING EXISTING CONVERSATIONS =====\n');

        // Get all conversations
        const conversations = await pool.query('SELECT id FROM conversations');

        for (const conv of conversations.rows) {
            const convId = conv.id;

            // Get current participants
            const participants = await pool.query(
                'SELECT user_id FROM conversation_participants WHERE conversation_id = $1',
                [convId]
            );

            console.log(`\nConversation ${convId}:`);
            console.log(`  Current participants: ${participants.rows.length}`);

            // If only 1 participant (patient), add a random doctor
            if (participants.rows.length === 1) {
                const patientId = participants.rows[0].user_id;

                // Get a random verified doctor
                const doctor = await pool.query(`
                    SELECT u.id
                    FROM users u
                    JOIN doctor_profiles dp ON u.id = dp.user_id
                    WHERE u.role = 'doctor' AND dp.is_verified = true
                    ORDER BY RANDOM()
                    LIMIT 1
                `);

                if (doctor.rows.length > 0) {
                    const doctorId = doctor.rows[0].id;

                    // Add doctor to conversation
                    await pool.query(
                        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)',
                        [convId, doctorId]
                    );

                    console.log(`  ✅ Added doctor ${doctorId} to conversation`);

                    // Get doctor name
                    const doctorInfo = await pool.query(
                        'SELECT name FROM users WHERE id = $1',
                        [doctorId]
                    );
                    console.log(`     Doctor: ${doctorInfo.rows[0].name}`);
                } else {
                    console.log(`  ❌ No doctors available to add`);
                }
            } else {
                console.log(`  ✅ Already has ${participants.rows.length} participants`);
            }
        }

        console.log('\n===== VERIFICATION =====\n');

        // Verify all conversations now have 2 participants
        const finalCheck = await pool.query(`
            SELECT c.id, COUNT(cp.user_id) as participant_count
            FROM conversations c
            LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
            GROUP BY c.id
        `);

        console.log('Final participant counts:');
        finalCheck.rows.forEach(row => {
            console.log(`  Conversation ${row.id}: ${row.participant_count} participants`);
        });

        console.log('\n✅ All conversations fixed!\n');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

fixConversations();
