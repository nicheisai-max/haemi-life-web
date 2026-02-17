import { pool } from '../src/config/db';
import dotenv from 'dotenv';

dotenv.config();

const seedChat = async () => {
    try {
        console.log('🌱 Seeding Chat Data for Botswana Context...');

        // 1. Get Key Users
        const patientRes = await pool.query("SELECT id, name FROM users WHERE email = 'patient@haemilife.com'");
        const doctorRes = await pool.query("SELECT id, name FROM users WHERE email = 'doctor@haemilife.com'");
        const adminRes = await pool.query("SELECT id, name FROM users WHERE email = 'admin@haemilife.com'");

        // Advanced Specialists (created in init.sql) - Try fine them, but fallback if not found
        let cardiologistRes = await pool.query("SELECT id, name FROM users WHERE email = 'thabo.sekgwi@haemilife.com'");
        let pediatricianRes = await pool.query("SELECT id, name FROM users WHERE email = 'lerato.molefe@haemilife.com'");

        // Fallback: Get ANY doctor if specific ones are missing
        if (cardiologistRes.rowCount === 0) {
            console.warn("⚠️ Dr. Thabo not found. Fetching random doctor for cardiology chat...");
            cardiologistRes = await pool.query("SELECT id, name FROM users WHERE role = 'doctor' AND email != 'doctor@haemilife.com' LIMIT 1");
        }

        if (patientRes.rowCount === 0) {
            console.error('❌ Patient (patient@haemilife.com) not found. Please ensure the DB is seeded.');
            process.exit(1);
        }

        const patient = patientRes.rows[0];
        const doctor = doctorRes.rows[0]; // Dr. Mpho Modise

        const cardiologist = cardiologistRes.rows[0] || doctor; // Fallback to Dr. Mpho if no other doctor
        const pediatrician = pediatricianRes.rows[0];

        console.log(`Found Patient: ${patient.name}`);

        // --- Helper to Create Conversation ---
        const createConversation = async (user1Id: string, user2Id: string, messages: any[]) => {
            // Check existing
            const existing = await pool.query(
                `SELECT c.id FROM conversations c
                 JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
                 JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
                 WHERE cp1.user_id = $1 AND cp2.user_id = $2
                 GROUP BY c.id HAVING COUNT(*) = 2`,
                [user1Id, user2Id]
            );

            let conversationId = existing.rows[0]?.id;

            if (!conversationId) {
                const convRes = await pool.query('INSERT INTO conversations DEFAULT VALUES RETURNING id');
                conversationId = convRes.rows[0].id;
                await pool.query('INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)', [conversationId, user1Id, user2Id]);
                console.log(`Created new conversation: ${conversationId}`);
            } else {
                console.log(`Using existing conversation: ${conversationId}`);
                // Optional: Clear old messages to avoid duplicates if re-seeding?
                // await pool.query('DELETE FROM messages WHERE conversation_id = $1', [conversationId]);
            }

            // Insert Messages
            for (const msg of messages) {
                // Check if message exists (duplicate check by content/time approximation) to allow idempotent runs without delete
                const msgCheck = await pool.query(
                    'SELECT id FROM messages WHERE conversation_id = $1 AND content = $2 AND sender_id = $3',
                    [conversationId, msg.content, msg.senderId]
                );

                if (msgCheck.rowCount === 0) {
                    await pool.query(
                        `INSERT INTO messages (conversation_id, sender_id, content, is_read, created_at, attachment_url, attachment_type)
                         VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${msg.timeOffset}', $5, $6)`,
                        [conversationId, msg.senderId, msg.content, true, msg.url || null, msg.type || null]
                    );
                }
            }

            // Update last_message
            await pool.query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [conversationId]);
        };

        // --- 1. Chat with Dr. Mpho Modise (GP) ---
        if (doctor) {
            await createConversation(patient.id, doctor.id, [
                { senderId: doctor.id, content: "Dumela Tebogo, how are you feeling after the medication?", timeOffset: '2 days' },
                { senderId: patient.id, content: "Much better Dr. Mpho. The fever has gone down.", timeOffset: '1 day 23 hours' },
                { senderId: doctor.id, content: "That is good to hear. Remember to finish the full course of Amoxil.", timeOffset: '1 day 22 hours' },
                { senderId: patient.id, content: "Will do. Can I come in for a follow-up next week?", timeOffset: '5 hours' },
                { senderId: doctor.id, content: "Yes, I have an opening on Tuesday at 10:00 AM.", timeOffset: '1 hour' },
                { senderId: doctor.id, content: "Here is your lab report for reference.", url: "/uploads/lab_report_tebogo.pdf", type: "document", timeOffset: '30 minutes' }
            ]);
        }

        // --- 2. Chat with Dr. Thabo Sekgwi (Cardiologist) ---
        if (cardiologist) {
            await createConversation(patient.id, cardiologist.id, [
                { senderId: cardiologist.id, content: "Mr. Motswana, your ECG results from Princess Marina look stable.", timeOffset: '5 days' },
                { senderId: patient.id, content: "Thank you Dr. Thabo. Should I continue the Lipitor?", timeOffset: '4 days' },
                { senderId: cardiologist.id, content: "Yes, please continue 20mg daily. We will review in 3 months.", timeOffset: '4 days' }
            ]);
        }

        console.log('✅ Chat Data Seeding Complete!');
    } catch (error) {
        console.error('❌ Error seeding chat:', error);
    } finally {
        await pool.end();
    }
};

seedChat();
