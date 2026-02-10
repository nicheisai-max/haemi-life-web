import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getMyPrescriptions } from '../../services/prescription.service';
import type { Prescription } from '../../services/prescription.service';
import './Prescriptions.css';

export const Prescriptions: React.FC = () => {
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

    useEffect(() => {
        fetchPrescriptions();
    }, []);

    const fetchPrescriptions = async () => {
        try {
            setLoading(true);
            const data = await getMyPrescriptions();
            setPrescriptions(data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load prescriptions');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'status-pending';
            case 'filled': return 'status-filled';
            case 'cancelled': return 'status-cancelled';
            default: return '';
        }
    };

    if (loading) {
        return (
            <div className="prescriptions-container">
                <Card style={{ padding: '2rem', textAlign: 'center' }}>
                    <div className="loading-spinner">Loading prescriptions...</div>
                </Card>
            </div>
        );
    }

    return (
        <div className="prescriptions-container fade-in">
            <div className="page-header">
                <div>
                    <h1>My Prescriptions</h1>
                    <p>View your prescription history and details</p>
                </div>
            </div>

            {error && (
                <Card className="alert alert-error">
                    <span className="material-icons-outlined">error</span>
                    {error}
                </Card>
            )}

            <div className="prescriptions-grid">
                {/* Prescriptions List */}
                <div className="prescriptions-list">
                    {prescriptions.length === 0 ? (
                        <Card style={{ padding: '3rem', textAlign: 'center' }}>
                            <span className="material-icons-outlined" style={{ fontSize: '64px', opacity: 0.3 }}>receipt_long</span>
                            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
                                No prescriptions found
                            </p>
                        </Card>
                    ) : (
                        prescriptions.map((prescription) => (
                            <Card
                                key={prescription.id}
                                className={`prescription-card hover-lift ${selectedPrescription?.id === prescription.id ? 'selected' : ''}`}
                                onClick={() => setSelectedPrescription(prescription)}
                            >
                                <div className="prescription-header">
                                    <div className="prescription-icon">
                                        <span className="material-icons-outlined">medication</span>
                                    </div>
                                    <div className="prescription-info">
                                        <div className="prescription-title">
                                            <h3>Dr. {prescription.doctor_name || 'Unknown'}</h3>
                                            <span className={`status-badge ${getStatusColor(prescription.status)}`}>
                                                {prescription.status}
                                            </span>
                                        </div>
                                        <p className="prescription-date">
                                            {new Date(prescription.created_at).toLocaleDateString('en-US', {
                                                month: 'long',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </p>
                                        <div className="prescription-meta">
                                            <span className="material-icons-outlined">medical_services</span>
                                            <span>{prescription.medication_count || 0} medication{(prescription.medication_count || 0) !== 1 ? 's' : ''}</span>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))
                    )}
                </div>

                {/* Details Panel */}
                {selectedPrescription && (
                    <Card className="details-panel">
                        <div className="details-header">
                            <h2>Prescription Details</h2>
                            <button className="close-btn" onClick={() => setSelectedPrescription(null)}>
                                <span className="material-icons-outlined">close</span>
                            </button>
                        </div>

                        <div className="details-section">
                            <h3>Doctor Information</h3>
                            <div className="info-item">
                                <span className="material-icons-outlined">person</span>
                                <div>
                                    <div className="info-label">Prescribing Doctor</div>
                                    <div className="info-value">Dr. {selectedPrescription.doctor_name || 'Unknown'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="details-section">
                            <h3>Prescription Details</h3>
                            <div className="info-item">
                                <span className="material-icons-outlined">event</span>
                                <div>
                                    <div className="info-label">Prescribed On</div>
                                    <div className="info-value">
                                        {new Date(selectedPrescription.created_at).toLocaleDateString('en-US', {
                                            weekday: 'long',
                                            month: 'long',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="info-item">
                                <span className="material-icons-outlined">verified</span>
                                <div>
                                    <div className="info-label">Status</div>
                                    <div className="info-value" style={{ textTransform: 'capitalize' }}>
                                        {selectedPrescription.status}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="details-section">
                            <h3>Medications</h3>
                            {selectedPrescription.medication_count && selectedPrescription.medication_count > 0 ? (
                                <div className="medications-list">
                                    <div className="medication-item">
                                        <div className="medication-icon">
                                            <span className="material-icons-outlined">local_pharmacy</span>
                                        </div>
                                        <div>
                                            <div className="medication-name">{selectedPrescription.medication_count} medication(s) prescribed</div>
                                            <div className="medication-note">View full details at pharmacy</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p style={{ color: 'var(--text-muted)' }}>No medication details available</p>
                            )}
                        </div>

                        {selectedPrescription.status === 'pending' && (
                            <div className="details-actions">
                                <Button
                                    variant="primary"
                                    fullWidth
                                    leftIcon={<span className="material-icons-outlined">local_pharmacy</span>}
                                >
                                    Fill at Pharmacy
                                </Button>
                            </div>
                        )}
                    </Card>
                )}
            </div>
        </div>
    );
};
