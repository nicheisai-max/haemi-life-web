
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'haemi_life',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
});

const verifyUser = async () => {
    console.log('Script started JS');
    try {
        console.log('Connecting to DB...');
        const client = await pool.connect();
        console.log('Connected!');

        const email = 'patient@haemilife.com';
        const password = 'password123';

        console.log(`Checking user: ${email}`);
        const res = await client.query('SELECT * FROM users WHERE email = $1', [email]);

        if (res.rows.length === 0) {
            console.log('❌ User NOT FOUND');
        } else {
            const user = res.rows[0];
            console.log('✅ User FOUND:', { id: user.id, email: user.email, role: user.role, status: user.status });

            const match = await bcrypt.compare(password, user.password);
            console.log(`Password match for '${password}': ${match ? '✅ YES' : '❌ NO'}`);

            if (!match) {
                // Debug hash
                console.log('Stored Hash:', user.password);
                const newHash = await bcrypt.hash(password, 10);
                console.log('New Hash would be:', newHash);
            }
        }
        client.release();
    } catch (err) {
        console.error('Error during verification:', err);
    } finally {
        await pool.end();
        console.log('Pool closed');
    }
};

verifyUser();
