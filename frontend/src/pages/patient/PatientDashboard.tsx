import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getMyAppointments } from '../../services/appointment.service';
import { getMyPrescriptions } from '../../services/prescription.service';
import type { Appointment } from '../../services/appointment.service';
import type { Prescription } from '../../services/prescription.service';
import './PatientDashboard.css';

export const PatientDashboard: React.FC = () => {
    const { user } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [apptData, prescData] = await Promise.all([
                getMyAppointments({ upcoming: true }),
                getMyPrescriptions()
            ]);
            setAppointments(apptData);
            setPrescriptions(prescData);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load dashboard data');
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return {
            day: date.getDate().toString(),
            month: date.toLocaleDateString('en-US', { month: 'short' })
        };
    };

    const formatTime = (timeStr: string) => {
        return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const upcomingAppointments = appointments.filter(a => a.status === 'scheduled').slice(0, 3);
    const activePrescriptions = prescriptions.filter(p => p.status === 'pending' || p.status === 'filled');

    return (
        <div className="dashboard-container fade-in">
            {/* Hero Section */}
            <div className="dashboard-hero">
                <div className="hero-content">
                    <h1>{getGreeting()}, {user?.name}</h1>
                    <p>
                        {loading
                            ? 'Loading your health overview...'
                            : `Here's your daily health overview. You have ${upcomingAppointments.length} upcoming appointment${upcomingAppointments.length !== 1 ? 's' : ''}.`
                        }
                    </p>
                </div>
                <div className="hero-actions">
                    <Button variant="primary" size="lg" leftIcon={<span className="material-icons-outlined">add</span>}>
                        Book Appointment
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="dashboard-grid stagger-1">
                <Card className="stat-card hover-lift">
                    <div className="stat-icon bg-blue-100 text-blue-600">
                        <span className="material-icons-outlined">calendar_today</span>
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{loading ? '...' : upcomingAppointments.length}</div>
                        <div className="stat-label">Upcoming Appointments</div>
                    </div>
                </Card>

                <Card className="stat-card hover-lift">
                    <div className="stat-icon bg-emerald-100 text-emerald-600">
                        <span className="material-icons-outlined">description</span>
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{loading ? '...' : activePrescriptions.length}</div>
                        <div className="stat-label">Active Prescriptions</div>
                    </div>
                </Card>

                <Card className="stat-card hover-lift">
                    <div className="stat-icon bg-purple-100 text-purple-600">
                        <span className="material-icons-outlined">folder_shared</span>
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{loading ? '...' : appointments.length}</div>
                        <div className="stat-label">Total Visits</div>
                    </div>
                </Card>
            </div>

            {/* Error Message */}
            {error && (
                <Card className="error-card" style={{
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    background: 'var(--color-error-bg)',
                    border: '1px solid var(--color-error)',
                    color: 'var(--color-error-text)'
                }}>
                    <span className="material-icons-outlined" style={{ marginRight: '0.5rem' }}>error</span>
                    {error}
                </Card>
            )}

            {/* Main Content Split */}
            <div className="content-grid stagger-2">
                {/* Left: Quick Actions & Tips */}
                <div className="main-column">
                    <section className="dashboard-section">
                        <div className="section-header">
                            <h2>Quick Actions</h2>
                        </div>
                        <div className="quick-actions-grid">
                            <Card className="action-card hover-lift">
                                <span className="material-icons-outlined action-icon">local_pharmacy</span>
                                <span>Order Medicine</span>
                            </Card>
                            <Card className="action-card hover-lift">
                                <span className="material-icons-outlined action-icon">search</span>
                                <span>Find Doctor</span>
                            </Card>
                            <Card className="action-card hover-lift">
                                <span className="material-icons-outlined action-icon">history</span>
                                <span>View History</span>
                            </Card>
                            <Card className="action-card hover-lift">
                                <span className="material-icons-outlined action-icon">settings</span>
                                <span>Settings</span>
                            </Card>
                        </div>
                    </section>

                    <section className="dashboard-section">
                        <div className="section-header">
                            <h2>Health Tips</h2>
                        </div>
                        <Card className="health-tip-card">
                            <div className="tip-content">
                                <h3>Stay Hydrated</h3>
                                <p>Drinking enough water is crucial for regulating body temperature and maintaining organ function.</p>
                            </div>
                            <span className="material-icons-outlined tip-icon">water_drop</span>
                        </Card>
                    </section>
                </div>

                {/* Right: Upcoming Appointments */}
                <div className="side-column">
                    <section className="dashboard-section">
                        <div className="section-header">
                            <h2>Appointments</h2>
                            <Button variant="ghost" size="sm">View All</Button>
                        </div>
                        <div className="appointment-list">
                            {loading ? (
                                <Card style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    Loading appointments...
                                </Card>
                            ) : upcomingAppointments.length === 0 ? (
                                <Card style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    <span className="material-icons-outlined" style={{ fontSize: '48px', opacity: 0.5 }}>event_busy</span>
                                    <p style={{ marginTop: '1rem' }}>No upcoming appointments</p>
                                </Card>
                            ) : (
                                upcomingAppointments.map((appointment) => {
                                    const dateInfo = formatDate(appointment.appointment_date);
                                    return (
                                        <Card key={appointment.id} className="appointment-item hover-lift">
                                            <div className="appointment-date">
                                                <span className="day">{dateInfo.day}</span>
                                                <span className="month">{dateInfo.month}</span>
                                            </div>
                                            <div className="appointment-details">
                                                <h3>{appointment.other_party_name || 'Doctor'}</h3>
                                                <p>{appointment.reason} • {formatTime(appointment.appointment_time)}</p>
                                            </div>
                                            <Button variant="outline" size="sm" className="action-btn">
                                                Details
                                            </Button>
                                        </Card>
                                    );
                                })
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};
