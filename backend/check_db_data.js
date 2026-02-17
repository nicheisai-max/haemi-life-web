const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME
});

async function checkData() {
    try {
        // Check doctors
        console.log('\n===== DOCTORS IN DATABASE =====');
        const doctors = await pool.query(`
            SELECT u.id, u.name, u.role, dp.specialization, dp.is_verified
            FROM users u
            LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
            WHERE u.role = 'doctor'
            LIMIT 10
        `);
        console.log('Total doctors:', doctors.rows.length);
        console.log(JSON.stringify(doctors.rows, null, 2));

        // Check conversations
        console.log('\n===== CONVERSATIONS =====');
        const conversations = await pool.query(`
            SELECT c.id, c.created_at, c.updated_at
            FROM conversations c
            LIMIT 10
        `);
        console.log('Total conversations:', conversations.rows.length);
        console.log(JSON.stringify(conversations.rows, null, 2));

        // Check conversation participants with names
        console.log('\n===== CONVERSATION PARTICIPANTS =====');
        const participants = await pool.query(`
            SELECT cp.conversation_id, cp.user_id, u.name, u.role
            FROM conversation_participants cp
            JOIN users u ON cp.user_id = u.id
            ORDER BY cp.conversation_id
            LIMIT 20
        `);
        console.log('Total participant records:', participants.rows.length);
        console.log(JSON.stringify(participants.rows, null, 2));

        // Check if there are any patients
        console.log('\n===== PATIENTS IN DATABASE =====');
        const patients = await pool.query(`
            SELECT id, name, role
            FROM users
            WHERE role = 'patient'
            LIMIT 5
        `);
        console.log('Total patients:', patients.rows.length);
        console.log(JSON.stringify(patients.rows, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkData();
