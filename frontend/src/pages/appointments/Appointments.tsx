import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getMyAppointments, cancelAppointment, updateAppointmentStatus } from '../../services/appointment.service';
import type { Appointment } from '../../services/appointment.service';
import './Appointments.css';

export const Appointments: React.FC = () => {
    const { user } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');

    useEffect(() => {
        fetchAppointments();
    }, []);

    useEffect(() => {
        applyFilter();
    }, [filter, appointments]);

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            const data = await getMyAppointments({});
            setAppointments(data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load appointments');
        } finally {
            setLoading(false);
        }
    };

    const applyFilter = () => {
        const now = new Date();
        let filtered = appointments;

        if (filter === 'upcoming') {
            filtered = appointments.filter(apt => {
                const aptDate = new Date(apt.appointment_date);
                return aptDate >= now && apt.status !== 'cancelled';
            });
        } else if (filter === 'past') {
            filtered = appointments.filter(apt => {
                const aptDate = new Date(apt.appointment_date);
                return aptDate < now || apt.status === 'completed' || apt.status === 'cancelled';
            });
        }

        setFilteredAppointments(filtered);
    };

    const handleCancel = async (appointmentId: string) => {
        if (!confirm('Are you sure you want to cancel this appointment?')) return;

        try {
            await cancelAppointment(appointmentId);
            await fetchAppointments();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to cancel appointment');
        }
    };

    const handleComplete = async (appointmentId: string) => {
        try {
            await updateAppointmentStatus(appointmentId, { status: 'completed' });
            await fetchAppointments();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to update appointment');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'scheduled': return 'status-scheduled';
            case 'completed': return 'status-completed';
            case 'cancelled': return 'status-cancelled';
            case 'no-show': return 'status-noshow';
            default: return '';
        }
    };

    if (loading) {
        return (
            <div className="appointments-container">
                <Card style={{ padding: '2rem', textAlign: 'center' }}>
                    <div className="loading-spinner">Loading appointments...</div>
                </Card>
            </div>
        );
    }

    return (
        <div className="appointments-container fade-in">
            <div className="page-header">
                <div>
                    <h1>My Appointments</h1>
                    <p>View and manage your appointments</p>
                </div>
                <Button
                    variant="primary"
                    leftIcon={<span className="material-icons-outlined">add</span>}
                    onClick={() => window.location.href = '/book-appointment'}
                >
                    Book New
                </Button>
            </div>

            {error && (
                <Card className="alert alert-error">
                    <span className="material-icons-outlined">error</span>
                    {error}
                    <button className="alert-close" onClick={() => setError(null)}>
                        <span className="material-icons-outlined">close</span>
                    </button>
                </Card>
            )}

            {/* Filters */}
            <div className="filters-bar">
                <button
                    className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    All ({appointments.length})
                </button>
                <button
                    className={`filter-btn ${filter === 'upcoming' ? 'active' : ''}`}
                    onClick={() => setFilter('upcoming')}
                >
                    Upcoming ({appointments.filter(a => new Date(a.appointment_date) >= new Date() && a.status !== 'cancelled').length})
                </button>
                <button
                    className={`filter-btn ${filter === 'past' ? 'active' : ''}`}
                    onClick={() => setFilter('past')}
                >
                    Past ({appointments.filter(a => new Date(a.appointment_date) < new Date() || a.status === 'completed' || a.status === 'cancelled').length})
                </button>
            </div>

            {/* Appointments List */}
            <div className="appointments-list">
                {filteredAppointments.length === 0 ? (
                    <Card style={{ padding: '3rem', textAlign: 'center' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '64px', opacity: 0.3 }}>event_busy</span>
                        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
                            No {filter === 'all' ? '' : filter} appointments found
                        </p>
                        <Button
                            variant="primary"
                            onClick={() => window.location.href = '/book-appointment'}
                            style={{ marginTop: '1rem' }}
                        >
                            Book Your First Appointment
                        </Button>
                    </Card>
                ) : (
                    filteredAppointments.map((appointment) => (
                        <Card key={appointment.id} className="appointment-card hover-lift">
                            <div className="appointment-header">
                                <div className="appointment-date-badge">
                                    <div className="date-day">
                                        {new Date(appointment.appointment_date).getDate()}
                                    </div>
                                    <div className="date-month">
                                        {new Date(appointment.appointment_date).toLocaleDateString('en-US', { month: 'short' })}
                                    </div>
                                </div>

                                <div className="appointment-main">
                                    <div className="appointment-title">
                                        <h3>{user?.role === 'doctor' ? appointment.other_party_name || 'Patient' : `Dr. ${appointment.other_party_name}` || 'Doctor'}</h3>
                                        <span className={`status-badge ${getStatusColor(appointment.status)}`}>
                                            {appointment.status}
                                        </span>
                                    </div>
                                    <p className="appointment-reason">{appointment.reason}</p>
                                    <div className="appointment-details">
                                        <div className="detail-item">
                                            <span className="material-icons-outlined">schedule</span>
                                            <span>{new Date(`2000-01-01T${appointment.appointment_time}`).toLocaleTimeString('en-US', {
                                                hour: 'numeric',
                                                minute: '2-digit',
                                                hour12: true
                                            })}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="material-icons-outlined">event</span>
                                            <span>{new Date(appointment.appointment_date).toLocaleDateString('en-US', {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="appointment-actions">
                                    {appointment.status === 'scheduled' && user?.role === 'doctor' && (
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={() => handleComplete(appointment.id)}
                                        >
                                            Mark Complete
                                        </Button>
                                    )}
                                    {appointment.status === 'scheduled' && new Date(appointment.appointment_date) > new Date() && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleCancel(appointment.id)}
                                        >
                                            Cancel
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};
