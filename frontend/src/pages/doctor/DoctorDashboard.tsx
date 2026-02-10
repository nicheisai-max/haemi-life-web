import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getMyAppointments } from '../../services/appointment.service';
import { getDoctorPatients } from '../../services/doctor.service';
import type { Appointment } from '../../services/appointment.service';
import '../patient/PatientDashboard.css';

export const DoctorDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [patientCount, setPatientCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [apptData, patientsData] = await Promise.all([
                getMyAppointments({ upcoming: true }),
                getDoctorPatients().catch(() => [])
            ]);
            setAppointments(apptData);
            setPatientCount(patientsData.length);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load dashboard data');
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
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

    const todayAppointments = appointments.filter(a => {
        const apptDate = new Date(a.appointment_date);
        const today = new Date();
        return apptDate.toDateString() === today.toDateString() && a.status === 'scheduled';
    }).slice(0, 3);

    const pendingReviews = appointments.filter(a => a.status === 'completed').length;

    return (
        <div className="dashboard-container fade-in">
            {/* Hero Section */}
            <div className="dashboard-hero">
                <div className="hero-content">
                    <h1>{getGreeting()}, {user?.name}</h1>
                    <p>
                        {loading
                            ? 'Loading your schedule...'
                            : `You have ${todayAppointments.length} appointment${todayAppointments.length !== 1 ? 's' : ''} today.${todayAppointments.length > 0 ? ' Next patient is in 15 mins.' : ''}`
                        }
                    </p>
                </div>
                <div className="hero-actions">
                    <Button variant="primary" size="lg" leftIcon={<span className="material-icons-outlined">event_available</span>}>
                        View Schedule
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="dashboard-grid stagger-1">
                <Card className="stat-card hover-lift">
                    <div className="stat-icon bg-blue-100 text-blue-600">
                        <span className="material-icons-outlined">people</span>
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{loading ? '...' : todayAppointments.length}</div>
                        <div className="stat-label">Today's Patients</div>
                    </div>
                </Card>

                <Card className="stat-card hover-lift">
                    <div className="stat-icon bg-amber-100 text-amber-600">
                        <span className="material-icons-outlined">pending_actions</span>
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{loading ? '...' : pendingReviews}</div>
                        <div className="stat-label">Completed Today</div>
                    </div>
                </Card>

                <Card className="stat-card hover-lift">
                    <div className="stat-icon bg-indigo-100 text-indigo-600">
                        <span className="material-icons-outlined">perm_contact_calendar</span>
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{loading ? '...' : patientCount}</div>
                        <div className="stat-label">Total Patients</div>
                    </div>
                </Card>
            </div>

            {/* Error Message */}
            {error && (
                <Card style={{
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
                {/* Left: Quick Actions */}
                <div className="main-column">
                    <section className="dashboard-section">
                        <div className="section-header">
                            <h2>Quick Actions</h2>
                        </div>
                        <div className="quick-actions-grid">
                            <Card className="action-card hover-lift">
                                <span className="material-icons-outlined action-icon">group_add</span>
                                <span>Add Patient</span>
                            </Card>
                            <Card className="action-card hover-lift">
                                <span className="material-icons-outlined action-icon">assignment</span>
                                <span>SOAP Notes</span>
                            </Card>
                            <Card className="action-card hover-lift">
                                <span className="material-icons-outlined action-icon">medication</span>
                                <span>Prescribe</span>
                            </Card>
                            <Card className="action-card hover-lift">
                                <span className="material-icons-outlined action-icon">analytics</span>
                                <span>Reports</span>
                            </Card>
                        </div>
                    </section>

                    <section className="dashboard-section">
                        <div className="section-header">
                            <h2>Quick Info</h2>
                        </div>
                        <Card className="health-tip-card" style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)' }}>
                            <div className="tip-content">
                                <h3>Appointments Overview</h3>
                                <p>{appointments.length} total appointments • {todayAppointments.length} scheduled today</p>
                            </div>
                            <span className="material-icons-outlined tip-icon">calendar_month</span>
                        </Card>
                    </section>
                </div>

                {/* Right: Today's Schedule */}
                <div className="side-column">
                    <section className="dashboard-section">
                        <div className="section-header">
                            <h2>Today's Schedule</h2>
                            <Button variant="ghost" size="sm">Full Calendar</Button>
                        </div>
                        <div className="appointment-list">
                            {loading ? (
                                <Card style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    Loading schedule...
                                </Card>
                            ) : todayAppointments.length === 0 ? (
                                <Card style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    <span className="material-icons-outlined" style={{ fontSize: '48px', opacity: 0.5 }}>event_available</span>
                                    <p style={{ marginTop: '1rem' }}>No appointments scheduled today</p>
                                </Card>
                            ) : (
                                todayAppointments.map((appointment) => (
                                    <Card key={appointment.id} className="appointment-item hover-lift">
                                        <div className="appointment-date bg-blue-50 text-blue-700">
                                            <span className="day">{formatTime(appointment.appointment_time).split(' ')[0]}</span>
                                            <span className="month">{formatTime(appointment.appointment_time).split(' ')[1]}</span>
                                        </div>
                                        <div className="appointment-details">
                                            <h3>{appointment.other_party_name || 'Patient'}</h3>
                                            <p>{appointment.reason}</p>
                                        </div>
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            className="action-btn"
                                            onClick={() => navigate(`/consultation/${appointment.id}`)}
                                        >
                                            Start
                                        </Button>
                                    </Card>
                                ))
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};
