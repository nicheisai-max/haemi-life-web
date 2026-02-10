import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getPendingPrescriptions, updatePrescriptionStatus } from '../../services/prescription.service';
import type { Prescription } from '../../services/prescription.service';
import './PrescriptionQueue.css';

export const PrescriptionQueue: React.FC = () => {
    const navigate = useNavigate();
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        fetchPrescriptions();
    }, []);

    const fetchPrescriptions = async () => {
        try {
            setLoading(true);
            const data = await getPendingPrescriptions();
            setPrescriptions(data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load prescription queue');
        } finally {
            setLoading(false);
        }
    };

    const handleFill = async (prescriptionId: string) => {
        try {
            setProcessing(prescriptionId);
            await updatePrescriptionStatus(prescriptionId, { status: 'filled' });
            await fetchPrescriptions();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fill prescription');
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (prescriptionId: string) => {
        if (!confirm('Are you sure you want to reject this prescription?')) return;

        try {
            setProcessing(prescriptionId);
            await updatePrescriptionStatus(prescriptionId, { status: 'cancelled' });
            await fetchPrescriptions();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to reject prescription');
        } finally {
            setProcessing(null);
        }
    };

    if (loading) {
        return (
            <div className="queue-container">
                <Card style={{ padding: '2rem', textAlign: 'center' }}>
                    <div className="loading-spinner">Loading queue...</div>
                </Card>
            </div>
        );
    }

    return (
        <div className="queue-container fade-in">
            <div className="page-header">
                <div>
                    <h1>Prescription Queue</h1>
                    <p>Process pending prescription orders</p>
                </div>
                <div className="queue-stats">
                    <div className="stat-badge">
                        <span className="stat-value">{prescriptions.length}</span>
                        <span className="stat-label">Pending</span>
                    </div>
                </div>
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

            <div className="queue-list">
                {prescriptions.length === 0 ? (
                    <Card style={{ padding: '3rem', textAlign: 'center' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '64px', opacity: 0.3, color: 'var(--color-success)' }}>check_circle</span>
                        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
                            All caught up! No pending prescriptions.
                        </p>
                    </Card>
                ) : (
                    prescriptions.map((prescription) => (
                        <Card key={prescription.id} className="queue-card hover-lift">
                            <div className="queue-header">
                                <div className="priority-indicator">
                                    <span className="material-icons-outlined">priority_high</span>
                                </div>
                                <div className="queue-info">
                                    <div className="queue-title">
                                        <h3>Patient: {prescription.patient_name || 'Unknown'}</h3>
                                        <span className="time-badge">
                                            <span className="material-icons-outlined">schedule</span>
                                            {new Date(prescription.created_at).toLocaleTimeString('en-US', {
                                                hour: 'numeric',
                                                minute: '2-digit',
                                                hour12: true
                                            })}
                                        </span>
                                    </div>
                                    <p className="queue-doctor">Prescribed by: Dr. {prescription.doctor_name || 'Unknown'}</p>
                                    <div className="queue-meta">
                                        <div className="meta-item">
                                            <span className="material-icons-outlined">event</span>
                                            <span>{new Date(prescription.created_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="material-icons-outlined">medication</span>
                                            <span>{prescription.medication_count || 0} item(s)</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="queue-actions">
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => handleFill(prescription.id)}
                                        disabled={processing === prescription.id}
                                        leftIcon={<span className="material-icons-outlined">check</span>}
                                    >
                                        Fill
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleReject(prescription.id)}
                                        disabled={processing === prescription.id}
                                        leftIcon={<span className="material-icons-outlined">close</span>}
                                    >
                                        Reject
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};
