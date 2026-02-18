
import { pool } from '../config/db';
import bcrypt from 'bcrypt';

const verifyUser = async () => {
    try {
        const client = await pool.connect();
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
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
};

verifyUser();
