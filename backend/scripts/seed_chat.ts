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
        let cardiologistRes = await pool.query("SELECT id, name FROM users WHERE email = 'thabo.kgosi@haemilife.com'");
        let pediatricianRes = await pool.query("SELECT id, name FROM users WHERE email = 'lorato.molefe@haemilife.com'");
        let gpRes = await pool.query("SELECT id, name FROM users WHERE email = 'neo.mousi@haemilife.com'");

        // Fallback: Get ANY doctor if specific ones are missing
        if (cardiologistRes.rowCount === 0) {
            console.warn("⚠️ Dr. Thabo not found. Fetching random doctor for cardiology chat...");
            cardiologistRes = await pool.query("SELECT id, name FROM users WHERE role = 'doctor' AND email != 'doctor@haemilife.com' LIMIT 1");
        }

        if (patientRes.rowCount === 0) {
            console.error('❌ Patient (patient@haemilife.com) not found. Please ensure the DB is seeded.');
            process.exit(1);
        }

        // --- 0. Clean Setup for Patient ---
        console.log('🧹 Clearing existing chat data for patient...');
        // Find all conversation IDs for this patient
        const existingConvs = await pool.query(
            `SELECT conversation_id FROM conversation_participants WHERE user_id = $1`,
            [patientRes.rows[0].id]
        );
        const convIds = existingConvs.rows.map(r => r.conversation_id);

        if (convIds.length > 0) {
            await pool.query(`DELETE FROM messages WHERE conversation_id = ANY($1)`, [convIds]);
            await pool.query(`DELETE FROM conversation_participants WHERE conversation_id = ANY($1)`, [convIds]);
            await pool.query(`DELETE FROM conversations WHERE id = ANY($1)`, [convIds]);
        }

        const patient = patientRes.rows[0];
        const doctor = doctorRes.rows[0]; // Dr. Mpho Modise

        const cardiologist = cardiologistRes.rows[0] || doctor; // Fallback to Dr. Mpho if no other doctor
        const pediatrician = pediatricianRes.rows[0];
        const gp = gpRes.rows[0];

        console.log(`Found Patient: ${patient.name}`);

        // --- Helper to Create Conversation ---
        const createConversation = async (user1Id: string, user2Id: string, messages: any[]) => {
            // Always create new since we cleaned up
            const convRes = await pool.query('INSERT INTO conversations DEFAULT VALUES RETURNING id');
            const conversationId = convRes.rows[0].id;

            await pool.query('INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)', [conversationId, user1Id, user2Id]);
            console.log(`Created new conversation: ${conversationId}`);

            let lastMsgTime = new Date(); // Default fallback

            // Insert Messages
            for (const msg of messages) {
                // Calculate explicit timestamp
                // msg.timeOffset is string like '2 days'. We need to parse or use SQL interval logic.
                // To guarantee match, we'll fetch the calculated time from DB or calculate in JS.
                // Simplest: Use JS date subtraction if format is simple, or let DB handle it and RETURN the timestamp.

                // Let's rely on DB returning the timestamp
                const insertRes = await pool.query(
                    `INSERT INTO messages (conversation_id, sender_id, content, is_read, created_at, attachment_url, attachment_type)
                     VALUES ($1, $2, $3, $4, NOW() - $5::INTERVAL, $6, $7)
                     RETURNING created_at`,
                    [conversationId, msg.senderId, msg.content, true, msg.timeOffset, msg.url || null, msg.type || null]
                );

                // Track the most recent message time (assuming messages are ordered or we check offsets)
                // In our data, the last message in array is usually the most recent or we can assume it for this simple seed.
                // Actually the data provided has varying offsets. The one with smallest offset is latest.
                // We'll update lastMsgTime to be the created_at of the message with smallest offset (latest).

                // Simple heuristic: The messages array is ordered oldest to newest in logic usually? 
                // Let's just capture the last inserted one as the 'latest' for now, or check dates.
                lastMsgTime = insertRes.rows[0].created_at;
            }

            // Update last_message with the EXACT timestamp of the last inserted message
            await pool.query('UPDATE conversations SET last_message_at = $2 WHERE id = $1', [conversationId, lastMsgTime]);
        };

        // --- 1. Chat with Dr. Mpho Modise (GP) - (Keep existing or replace, but user asked for SPECIFIC images so let's check Dr. Mpho mapping)
        // Check ChatHub mapping: Dr. Mpho is NOT mapped. 
        // We have 3 images: doctor01 (Thabo), doctor02 (Lorato), doctor03 (Neo).
        // So we should prioritize conversations with Thabo, Lorato, and Neo.

        // --- 1. Chat with Dr. Neo Mousi (GP) ---
        if (gp) {
            await createConversation(patient.id, gp.id, [
                { senderId: gp.id, content: "Dumela Tebogo, your general checkup results are in.", timeOffset: '2 days' },
                { senderId: patient.id, content: "Thank you Dr. Neo. Is everything okay?", timeOffset: '1 day 23 hours' },
                { senderId: gp.id, content: "Yes, everything looks normal. Keep up the good work!", timeOffset: '1 day 22 hours' }
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

        // --- 3. Chat with Dr. Lorato Molefe (Pediatrician) ---
        if (pediatrician) {
            await createConversation(patient.id, pediatrician.id, [
                { senderId: patient.id, content: "Dr. Lorato, can I schedule a vaccination for my son?", timeOffset: '1 week' },
                { senderId: pediatrician.id, content: "Certainly. We have slots open this Friday morning.", timeOffset: '6 days' }
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
