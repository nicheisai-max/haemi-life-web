import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Load environment variables first
dotenv.config();

import { pool } from './config/db';
import authRoutes from './routes/auth.routes';
import commonRoutes from './routes/common.routes';
import doctorRoutes from './routes/doctor.routes';
import appointmentRoutes from './routes/appointment.routes';
import prescriptionRoutes from './routes/prescription.routes';
import adminRoutes from './routes/admin.routes';
import analyticsRoutes from './routes/analytics.routes';
// // import passwordResetRoutes from './routes/password-reset.routes';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Adjust for production
        methods: ["GET", "POST"]
    }
});

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
app.use('/api/analytics', analyticsRoutes);
// app.use('/api/password-reset', passwordResetRoutes);

// Basic health check route
app.get('/', (req, res) => {
    res.send('Haemi Life Backend + Signaling Server is running');
});

// Socket.io Signaling Logic
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-consultation', (appointmentId) => {
        socket.join(appointmentId);
        console.log(`User ${socket.id} joined consultation room: ${appointmentId}`);
        socket.to(appointmentId).emit('participant-joined', socket.id);
    });

    socket.on('call-user', ({ offer, to }) => {
        socket.to(to).emit('call-made', { offer, socket: socket.id });
    });

    socket.on('make-answer', ({ answer, to }) => {
        socket.to(to).emit('answer-made', { answer, socket: socket.id });
    });

    socket.on('ice-candidate', ({ candidate, to }) => {
        socket.to(to).emit('ice-candidate', { candidate, socket: socket.id });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

httpServer.listen(port, () => {
    console.log(`Server (with signaling) is running on port ${port}`);
    // Test DB connection
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error('Error connecting to database', err);
        } else {
            console.log('Database connected successfully');
        }
    });
});
