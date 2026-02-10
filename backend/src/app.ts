import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

import { pool } from './config/db';
import authRoutes from './routes/auth.routes';
import commonRoutes from './routes/common.routes';
import doctorRoutes from './routes/doctor.routes';
import appointmentRoutes from './routes/appointment.routes';
import prescriptionRoutes from './routes/prescription.routes';
import adminRoutes from './routes/admin.routes';
import passwordResetRoutes from './routes/password-reset.routes';

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/common', commonRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/password-reset', passwordResetRoutes);

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
