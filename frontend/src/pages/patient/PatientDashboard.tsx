import React from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import './PatientDashboard.css';

export const PatientDashboard: React.FC = () => {
    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h1>Patient Dashboard</h1>
                <p>Welcome back! Here's your health overview.</p>
            </div>

            <div className="dashboard-grid">
                <Card padding="lg" className="stats-card">
                    <div className="stat-label">Upcoming Appointments</div>
                    <div className="stat-value">2</div>
                </Card>

                <Card padding="lg" className="stats-card">
                    <div className="stat-label">Prescriptions</div>
                    <div className="stat-value">3</div>
                </Card>

                <Card padding="lg" className="stats-card">
                    <div className="stat-label">Medical Records</div>
                    <div className="stat-value">12</div>
                </Card>
            </div>

            <div className="dashboard-section">
                <h2>Quick Actions</h2>
                <div className="action-grid">
                    <Button variant="primary" size="lg">
                        Book Appointment
                    </Button>
                    <Button variant="secondary" size="lg">
                        Find Doctors
                    </Button>
                    <Button variant="outline" size="lg">
                        View Records
                    </Button>
                </div>
            </div>

            <div className="dashboard-section">
                <h2>Upcoming Appointments</h2>
                <Card>
                    <div className="appointment-list">
                        <div className="appointment-item">
                            <div className="appointment-info">
                                <h3>Dr. Smith - General Checkup</h3>
                                <p>Tomorrow, 10:00 AM</p>
                            </div>
                            <Button variant="outline" size="sm">View Details</Button>
                        </div>
                        <div className="appointment-item">
                            <div className="appointment-info">
                                <h3>Dr. Johnson - Follow-up</h3>
                                <p>Friday, 2:00 PM</p>
                            </div>
                            <Button variant="outline" size="sm">View Details</Button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
