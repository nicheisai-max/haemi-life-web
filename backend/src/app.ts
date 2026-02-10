import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

import { pool } from './config/db';
import authRoutes from './routes/auth.routes';

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Basic health check route
app.get('/', (req, res) => {
    res.send('Haemi Life Backend is running');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    // Test DB connection
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error('Error connecting to database', err);
        } else {
            console.log('Database connected successfully');
        }
    });
});
