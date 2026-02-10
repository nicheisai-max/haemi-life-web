import React from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import '../patient/PatientDashboard.css'; // Reuse styles

export const PharmacistDashboard: React.FC = () => {
    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h1>Pharmacist Dashboard</h1>
                <p>Manage prescriptions and pharmacy inventory.</p>
            </div>

            <div className="dashboard-grid">
                <Card padding="lg" className="stats-card">
                    <div className="stat-label">Pending Prescriptions</div>
                    <div className="stat-value">15</div>
                </Card>

                <Card padding="lg" className="stats-card">
                    <div className="stat-label">Filled Today</div>
                    <div className="stat-value">23</div>
                </Card>

                <Card padding="lg" className="stats-card">
                    <div className="stat-label">Low Stock Items</div>
                    <div className="stat-value">7</div>
                </Card>
            </div>

            <div className="dashboard-section">
                <h2>Quick Actions</h2>
                <div className="action-grid">
                    <Button variant="primary" size="lg">
                        Validate Prescription
                    </Button>
                    <Button variant="secondary" size="lg">
                        Manage Inventory
                    </Button>
                    <Button variant="outline" size="lg">
                        View Reports
                    </Button>
                </div>
            </div>

            <div className="dashboard-section">
                <h2>Pending Prescriptions</h2>
                <Card>
                    <div className="appointment-list">
                        <div className="appointment-item">
                            <div className="appointment-info">
                                <h3>Patient: John Doe</h3>
                                <p>Medication: Amoxicillin 500mg • Prescribed by Dr. Smith</p>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <Button variant="primary" size="sm">Fill</Button>
                                <Button variant="outline" size="sm">View</Button>
                            </div>
                        </div>
                        <div className="appointment-item">
                            <div className="appointment-info">
                                <h3>Patient: Jane Smith</h3>
                                <p>Medication: Metformin 850mg • Prescribed by Dr. Johnson</p>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                <Button variant="primary" size="sm">Fill</Button>
                                <Button variant="outline" size="sm">View</Button>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
