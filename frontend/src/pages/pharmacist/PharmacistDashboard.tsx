import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getPendingPrescriptions } from '../../services/prescription.service';
import type { Prescription } from '../../services/prescription.service';
import '../patient/PatientDashboard.css';

export const PharmacistDashboard: React.FC = () => {
    const { user } = useAuth();
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const prescData = await getPendingPrescriptions();
            setPrescriptions(prescData);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load dashboard data');
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const pendingOrders = prescriptions.filter(p => p.status === 'pending');
    const todayFilled = prescriptions.filter(p => {
        if (p.status !== 'filled') return false;
        const updated = new Date(p.updated_at);
        const today = new Date();
        return updated.toDateString() === today.toDateString();
    }).length;

    return (
        <div className="dashboard-container fade-in">
            {/* Hero Section */}
            <div className="dashboard-hero">
                <div className="hero-content">
                    <h1>{getGreeting()}, {user?.name}</h1>
                    <p>
                        {loading
                            ? 'Loading pharmacy operations...'
                            : `${pendingOrders.length} new prescription${pendingOrders.length !== 1 ? 's' : ''} pending review. Inventory levels are stable.`
                        }
                    </p>
                </div>
                <div className="hero-actions">
                    <Button variant="primary" size="lg" leftIcon={<span className="material-icons-outlined">qr_code_scanner</span>}>
                        Scan Prescription
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="dashboard-grid stagger-1">
                <Card className="stat-card hover-lift">
                    <div className="stat-icon bg-teal-100 text-teal-600">
                        <span className="material-icons-outlined">receipt_long</span>
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{loading ? '...' : pendingOrders.length}</div>
                        <div className="stat-label">Pending Orders</div>
                    </div>
                </Card>

                <Card className="stat-card hover-lift">
                    <div className="stat-icon bg-green-100 text-green-600">
                        <span className="material-icons-outlined">check_circle</span>
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{loading ? '...' : todayFilled}</div>
                        <div className="stat-label">Filled Today</div>
                    </div>
                </Card>

                <Card className="stat-card hover-lift">
                    <div className="stat-icon bg-orange-100 text-orange-600">
                        <span className="material-icons-outlined">inventory</span>
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{loading ? '...' : prescriptions.length}</div>
                        <div className="stat-label">Total Prescriptions</div>
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
                                <span className="material-icons-outlined action-icon">assignment_turned_in</span>
                                <span>Validate</span>
                            </Card>
                            <Card className="action-card hover-lift">
                                <span className="material-icons-outlined action-icon">inventory</span>
                                <span>Inventory</span>
                            </Card>
                            <Card className="action-card hover-lift">
                                <span className="material-icons-outlined action-icon">point_of_sale</span>
                                <span>New Sale</span>
                            </Card>
                            <Card className="action-card hover-lift">
                                <span className="material-icons-outlined action-icon">local_shipping</span>
                                <span>Orders</span>
                            </Card>
                        </div>
                    </section>

                    <section className="dashboard-section">
                        <div className="section-header">
                            <h2>Operations Status</h2>
                        </div>
                        <Card className="health-tip-card" style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)' }}>
                            <div className="tip-content">
                                <h3>Pharmacy Overview</h3>
                                <p>{prescriptions.length} total prescriptions • {pendingOrders.length} pending fulfillment</p>
                            </div>
                            <span className="material-icons-outlined tip-icon">local_pharmacy</span>
                        </Card>
                    </section>
                </div>

                {/* Right: Pending Queue */}
                <div className="side-column">
                    <section className="dashboard-section">
                        <div className="section-header">
                            <h2>Pending Queue</h2>
                            <Button variant="ghost" size="sm">View All</Button>
                        </div>
                        <div className="appointment-list">
                            {loading ? (
                                <Card style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    Loading queue...
                                </Card>
                            ) : pendingOrders.length === 0 ? (
                                <Card style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    <span className="material-icons-outlined" style={{ fontSize: '48px', opacity: 0.5 }}>done_all</span>
                                    <p style={{ marginTop: '1rem' }}>All prescriptions processed</p>
                                </Card>
                            ) : (
                                pendingOrders.slice(0, 3).map((prescription) => (
                                    <Card key={prescription.id} className="appointment-item hover-lift">
                                        <div className="appointment-date bg-teal-50 text-teal-700">
                                            <span className="day">New</span>
                                        </div>
                                        <div className="appointment-details">
                                            <h3>{prescription.patient_name || 'Patient'}</h3>
                                            <p>{prescription.medication_count || 0} item{(prescription.medication_count || 0) !== 1 ? 's' : ''} • Dr. {prescription.doctor_name || 'N/A'}</p>
                                        </div>
                                        <Button variant="primary" size="sm" className="action-btn">
                                            Process
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
