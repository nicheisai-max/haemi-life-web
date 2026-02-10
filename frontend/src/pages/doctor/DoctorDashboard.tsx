import React from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import '../patient/PatientDashboard.css'; // Reuse styles

export const DoctorDashboard: React.FC = () => {
    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h1>Doctor Dashboard</h1>
                <p>Manage your appointments and patient consultations.</p>
            </div>

            <div className="dashboard-grid">
                <Card padding="lg" className="stats-card">
                    <div className="stat-label">Today's Appointments</div>
                    <div className="stat-value">8</div>
                </Card>

                <Card padding="lg" className="stats-card">
                    <div className="stat-label">Pending Consultations</div>
                    <div className="stat-value">5</div>
                </Card>

                <Card padding="lg" className="stats-card">
                    <div className="stat-label">Total Patients</div>
                    <div className="stat-value">142</div>
                </Card>
            </div>

            <div className="dashboard-section">
                <h2>Quick Actions</h2>
                <div className="action-grid">
                    <Button variant="primary" size="lg">
                        View Schedule
                    </Button>
                    <Button variant="secondary" size="lg">
                        Patient Queue
                    </Button>
                    <Button variant="outline" size="lg">
                        Create SOAP Note
                    </Button>
                </div>
            </div>

            <div className="dashboard-section">
                <h2>Today's Schedule</h2>
                <Card>
                    <div className="appointment-list">
                        <div className="appointment-item">
                            <div className="appointment-info">
                                <h3>John Doe - General Checkup</h3>
                                <p>10:00 AM - 10:30 AM</p>
                            </div>
                            <Button variant="primary" size="sm">Start Consultation</Button>
                        </div>
                        <div className="appointment-item">
                            <div className="appointment-info">
                                <h3>Jane Smith - Follow-up</h3>
                                <p>11:00 AM - 11:30 AM</p>
                            </div>
                            <Button variant="outline" size="sm">View Details</Button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
