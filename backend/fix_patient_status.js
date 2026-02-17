const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME
});

async function fixPatientAccount() {
    try {
        console.log('\n===== FIXING PATIENT ACCOUNT STATUS =====\n');

        // Check patient status
        const patient = await pool.query(`
            SELECT id, name, email, role, is_active, created_at
            FROM users
            WHERE role = 'patient'
        `);

        console.log(`Found ${patient.rows.length} patient(s):\n`);

        for (const p of patient.rows) {
            console.log(`Patient: ${p.name}`);
            console.log(`  Email: ${p.email}`);
            console.log(`  Current Status: ${p.is_active ? 'ACTIVE' : 'INACTIVE'}`);

            if (!p.is_active) {
                console.log(`  ⚠️  Activating account...`);

                await pool.query(
                    'UPDATE users SET is_active = true WHERE id = $1',
                    [p.id]
                );

                console.log(`  ✅ Account activated!`);
            } else {
                console.log(`  ✅ Already active`);
            }
            console.log('');
        }

        // Verify
        console.log('\n===== VERIFICATION =====\n');
        const verification = await pool.query(`
            SELECT name, email, is_active
            FROM users
            WHERE role = 'patient'
        `);

        verification.rows.forEach(p => {
            console.log(`${p.name}: ${p.is_active ? '✅ ACTIVE' : '❌ INACTIVE'}`);
        });

        console.log('\n✅ Patient account status fixed!\n');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

fixPatientAccount();
