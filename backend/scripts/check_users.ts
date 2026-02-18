
import { pool } from '../src/config/db';
import dotenv from 'dotenv';
dotenv.config();

const checkUsers = async () => {
    try {
        console.log('Checking users...');
        const res = await pool.query('SELECT id, name, role, email, status, is_verified FROM users WHERE email IN (\'patient@haemilife.com\', \'doctor@haemilife.com\', \'pharmacist@haemilife.com\', \'admin@haemilife.com\')');
        console.table(res.rows);
    } catch (error) {
        console.error('Error checking users:', error);
    } finally {
        await pool.end();
    }
};

checkUsers();
