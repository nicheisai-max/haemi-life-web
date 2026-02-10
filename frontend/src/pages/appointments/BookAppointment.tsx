import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getDoctors, getAvailableSlots } from '../../services/doctor.service';
import { bookAppointment } from '../../services/appointment.service';
import type { DoctorProfile } from '../../services/doctor.service';
import type { AvailableSlots } from '../../services/doctor.service';
import './BookAppointment.css';

export const BookAppointment: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const preselectedDoctorId = searchParams.get('doctorId');

    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [selectedDoctor, setSelectedDoctor] = useState<string>('');
    const [appointmentDate, setAppointmentDate] = useState('');
    const [appointmentTime, setAppointmentTime] = useState('');
    const [reason, setReason] = useState('');
    const [availableSlots, setAvailableSlots] = useState<AvailableSlots | null>(null);

    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        fetchDoctors();
    }, []);

    useEffect(() => {
        if (preselectedDoctorId) {
            setSelectedDoctor(preselectedDoctorId);
        }
    }, [preselectedDoctorId, doctors]);

    useEffect(() => {
        if (selectedDoctor && appointmentDate) {
            fetchAvailableSlots();
        }
    }, [selectedDoctor, appointmentDate]);

    const fetchDoctors = async () => {
        try {
            setLoading(true);
            const data = await getDoctors();
            setDoctors(data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load doctors');
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableSlots = async () => {
        try {
            const slots = await getAvailableSlots(selectedDoctor, appointmentDate);
            setAvailableSlots(slots);
        } catch (err: any) {
            console.error('Failed to fetch slots:', err);
            setAvailableSlots(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedDoctor || !appointmentDate || !appointmentTime || !reason) {
            setError('Please fill in all fields');
            return;
        }

        try {
            setBooking(true);
            setError(null);

            await bookAppointment({
                doctor_id: selectedDoctor,
                appointment_date: appointmentDate,
                appointment_time: appointmentTime,
                reason: reason
            });

            setSuccess(true);
            setTimeout(() => {
                navigate('/appointments');
            }, 2000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to book appointment');
        } finally {
            setBooking(false);
        }
    };

    const selectedDoctorData = doctors.find(d => d.id === selectedDoctor);

    // Generate next 14 days for date picker
    const getAvailableDates = () => {
        const dates = [];
        const today = new Date();
        for (let i = 1; i <= 14; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            dates.push(date.toISOString().split('T')[0]);
        }
        return dates;
    };

    if (success) {
        return (
            <div className="book-appointment-container">
                <Card className="success-card">
                    <span className="material-icons-outlined success-icon">check_circle</span>
                    <h2>Appointment Booked!</h2>
                    <p>Your appointment has been successfully scheduled.</p>
                    <p className="redirect-text">Redirecting to appointments...</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="book-appointment-container fade-in">
            <div className="page-header">
                <h1>Book Appointment</h1>
                <p>Schedule a consultation with a healthcare professional</p>
            </div>

            {error && (
                <Card className="alert alert-error">
                    <span className="material-icons-outlined">error</span>
                    {error}
                </Card>
            )}

            <div className="booking-grid">
                {/* Booking Form */}
                <Card className="booking-form-card">
                    <h2>Appointment Details</h2>

                    <form onSubmit={handleSubmit} className="booking-form">
                        <div className="form-group">
                            <label htmlFor="doctor">Select Doctor *</label>
                            <select
                                id="doctor"
                                className="form-select"
                                value={selectedDoctor}
                                onChange={(e) => setSelectedDoctor(e.target.value)}
                                required
                                disabled={loading}
                            >
                                <option value="">Choose a doctor...</option>
                                {doctors.map(doctor => (
                                    <option key={doctor.id} value={doctor.id}>
                                        {doctor.name} - {doctor.specialization}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="date">Appointment Date *</label>
                            <select
                                id="date"
                                className="form-select"
                                value={appointmentDate}
                                onChange={(e) => setAppointmentDate(e.target.value)}
                                required
                                disabled={!selectedDoctor}
                            >
                                <option value="">Select a date...</option>
                                {getAvailableDates().map(date => (
                                    <option key={date} value={date}>
                                        {new Date(date).toLocaleDateString('en-US', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="time">Appointment Time *</label>
                            <select
                                id="time"
                                className="form-select"
                                value={appointmentTime}
                                onChange={(e) => setAppointmentTime(e.target.value)}
                                required
                                disabled={!appointmentDate}
                            >
                                <option value="">Select a time...</option>
                                {availableSlots?.slots.map(slot => (
                                    <option key={slot} value={slot}>
                                        {new Date(`2000-01-01T${slot}`).toLocaleTimeString('en-US', {
                                            hour: 'numeric',
                                            minute: '2-digit',
                                            hour12: true
                                        })}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="reason">Reason for Visit *</label>
                            <textarea
                                id="reason"
                                className="form-textarea"
                                rows={4}
                                placeholder="Describe your symptoms or reason for visit..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            variant="primary"
                            fullWidth
                            size="lg"
                            disabled={booking}
                            leftIcon={booking ? undefined : <span className="material-icons-outlined">event</span>}
                        >
                            {booking ? 'Booking...' : 'Book Appointment'}
                        </Button>
                    </form>
                </Card>

                {/* Appointment Summary */}
                {selectedDoctorData && (
                    <Card className="summary-card">
                        <h2>Appointment Summary</h2>

                        <div className="summary-section">
                            <h3>Doctor</h3>
                            <div className="doctor-summary">
                                <div className="doctor-avatar-small">
                                    <span className="material-icons-outlined">person</span>
                                </div>
                                <div>
                                    <div className="doctor-name">{selectedDoctorData.name}</div>
                                    <div className="doctor-spec">{selectedDoctorData.specialization}</div>
                                </div>
                            </div>
                        </div>

                        {appointmentDate && (
                            <div className="summary-section">
                                <h3>Date & Time</h3>
                                <div className="summary-item">
                                    <span className="material-icons-outlined">event</span>
                                    <span>{new Date(appointmentDate).toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}</span>
                                </div>
                                {appointmentTime && (
                                    <div className="summary-item">
                                        <span className="material-icons-outlined">schedule</span>
                                        <span>{new Date(`2000-01-01T${appointmentTime}`).toLocaleTimeString('en-US', {
                                            hour: 'numeric',
                                            minute: '2-digit',
                                            hour12: true
                                        })}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {reason && (
                            <div className="summary-section">
                                <h3>Reason</h3>
                                <p className="reason-text">{reason}</p>
                            </div>
                        )}
                    </Card>
                )}
            </div>
        </div>
    );
};
