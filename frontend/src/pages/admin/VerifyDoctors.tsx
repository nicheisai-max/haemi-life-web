import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getPendingVerifications, verifyDoctor } from '../../services/admin.service';
import type { PendingVerification } from '../../services/admin.service';
import './VerifyDoctors.css';

export const VerifyDoctors: React.FC = () => {
    const [verifications, setVerifications] = useState<PendingVerification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        fetchVerifications();
    }, []);

    const fetchVerifications = async () => {
        try {
            setLoading(true);
            const data = await getPendingVerifications();
            setVerifications(data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load verifications');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (doctorId: string, approved: boolean) => {
        try {
            setProcessing(doctorId);
            await verifyDoctor(doctorId, { approved });
            await fetchVerifications();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to process verification');
        } finally {
            setProcessing(null);
        }
    };

    if (loading) {
        return (
            <div className="verify-container">
                <Card style={{ padding: '2rem', textAlign: 'center' }}>
                    <div className="loading-spinner">Loading verifications...</div>
                </Card>
            </div>
        );
    }

    return (
        <div className="verify-container fade-in">
            <div className="page-header">
                <div>
                    <h1>Verify Doctors</h1>
                    <p>Review and approve doctor registrations</p>
                </div>
                <div className="pending-badge">
                    <span className="material-icons-outlined">pending</span>
                    {verifications.length} Pending
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

            <div className="verifications-list">
                {verifications.length === 0 ? (
                    <Card style={{ padding: '3rem', textAlign: 'center' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '64px', opacity: 0.3, color: 'var(--color-success)' }}>verified_user</span>
                        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
                            All doctor verifications are up to date!
                        </p>
                    </Card>
                ) : (
                    verifications.map((verification) => (
                        <Card key={verification.doctor_id} className="verification-card hover-lift">
                            <div className="verification-header">
                                <div className="doctor-avatar">
                                    <span className="material-icons-outlined">person</span>
                                </div>
                                <div className="verification-info">
                                    <h3>{verification.name}</h3>
                                    <p className="email">{verification.email}</p>
                                    <p className="phone">{verification.phone_number}</p>
                                </div>
                            </div>

                            <div className="verification-details">
                                <div className="detail-row">
                                    <span className="detail-label">Specialization</span>
                                    <span className="detail-value">{verification.specialization || 'N/A'}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">License Number</span>
                                    <span className="detail-value">{verification.license_number || 'N/A'}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Experience</span>
                                    <span className="detail-value">{verification.years_of_experience || 0} years</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Registration Date</span>
                                    <span className="detail-value">
                                        {new Date(verification.created_at).toLocaleDateString('en-US', {
                                            month: 'long',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </span>
                                </div>
                            </div>

                            <div className="verification-actions">
                                <Button
                                    variant="outline"
                                    fullWidth
                                    onClick={() => handleVerify(verification.doctor_id, false)}
                                    disabled={processing === verification.doctor_id}
                                    leftIcon={<span className="material-icons-outlined">close</span>}
                                >
                                    Reject
                                </Button>
                                <Button
                                    variant="primary"
                                    fullWidth
                                    onClick={() => handleVerify(verification.doctor_id, true)}
                                    disabled={processing === verification.doctor_id}
                                    leftIcon={<span className="material-icons-outlined">check</span>}
                                >
                                    Approve
                                </Button>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};
