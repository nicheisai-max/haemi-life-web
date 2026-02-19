import dotenv from 'dotenv';
dotenv.config();
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'Loaded' : 'Missing');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Loaded' : 'Missing');
console.log('Current Directory:', process.cwd());
