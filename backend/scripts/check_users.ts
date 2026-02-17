
import { pool } from '../src/config/db';
import dotenv from 'dotenv';
dotenv.config();

const checkUsers = async () => {
    try {
        console.log('Checking users...');
        const res = await pool.query('SELECT id, name, email, role, status FROM users');
        console.table(res.rows);
    } catch (error) {
        console.error('Error checking users:', error);
    } finally {
        await pool.end();
    }
};

checkUsers();
