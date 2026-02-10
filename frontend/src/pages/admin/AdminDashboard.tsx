import React from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import '../patient/PatientDashboard.css'; // Reuse styles

export const AdminDashboard: React.FC = () => {
    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h1>Admin Dashboard</h1>
                <p>Manage users, verify doctors, and monitor system activity.</p>
            </div>

            <div className="dashboard-grid">
                <Card padding="lg" className="stats-card">
                    <div className="stat-label">Pending Verifications</div>
                    <div className="stat-value">12</div>
                </Card>

                <Card padding="lg" className="stats-card">
                    <div className="stat-label">Total Users</div>
                    <div className="stat-value">1,234</div>
                </Card>

                <Card padding="lg" className="stats-card">
                    <div className="stat-label">Active Sessions</div>
                    <div className="stat-value">89</div>
                </Card>
            </div>

            <div className="dashboard-section">
                <h2>Admin Actions</h2>
                <div className="action-grid">
                    <Button variant="primary" size="lg">
                        Verify Doctors
                    </Button>
                    <Button variant="secondary" size="lg">
                        Manage Users
                    </Button>
                    <Button variant="outline" size="lg">
                        View Audit Logs
                    </Button>
                </div>
            </div>

            <div className="dashboard-section">
                <h2>Pending Doctor Verifications</h2>
                <Card>
                    <div className="appointment-list">
                        <div className="appointment-item">
                            <div className="appointment-info">
                                <h3>Dr. Michael Brown - Cardiologist</h3>
                                <p>License: BOT-12345 • Submitted 2 days ago</p>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <Button variant="primary" size="sm">Approve</Button>
                                <Button variant="danger" size="sm">Reject</Button>
                            </div>
                        </div>
                        <div className="appointment-item">
                            <div className="appointment-info">
                                <h3>Dr. Sarah Lee - Pediatrician</h3>
                                <p>License: BOT-67890 • Submitted 1 day ago</p>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <Button variant="primary" size="sm">Approve</Button>
                                <Button variant="danger" size="sm">Reject</Button>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
