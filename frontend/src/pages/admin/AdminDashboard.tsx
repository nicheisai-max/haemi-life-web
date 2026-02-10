import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getSystemStats, getAuditLogs, getPendingVerifications } from '../../services/admin.service';
import type { SystemStats, AuditLog } from '../../services/admin.service';
import '../patient/PatientDashboard.css';

export const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [statsData, logsData, pendingData] = await Promise.all([
                getSystemStats(),
                getAuditLogs({ limit: 3 }),
                getPendingVerifications().catch(() => [])
            ]);
            setStats(statsData);
            setLogs(logsData);
            setPendingCount(pendingData.length);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load dashboard data');
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-US', {
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

    return (
        <div className="dashboard-container fade-in">
            {/* Hero Section */}
            <div className="dashboard-hero">
                <div className="hero-content">
                    <h1>{getGreeting()}, {user?.name}</h1>
                    <p>
                        {loading
                            ? 'Loading system overview...'
                            : `System performance is optimal. ${pendingCount} verification${pendingCount !== 1 ? 's' : ''} pending.`
                        }
                    </p>
                </div>
                <div className="hero-actions">
                    <Button variant="primary" size="lg" leftIcon={<span className="material-icons-outlined">verified_user</span>}>
                        Review Verifications
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="dashboard-grid stagger-1">
                <Card className="stat-card hover-lift">
                    <div className="stat-icon bg-orange-100 text-orange-600">
                        <span className="material-icons-outlined">rule</span>
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{loading ? '...' : pendingCount}</div>
                        <div className="stat-label">Pending Verifications</div>
                    </div>
                </Card>

                <Card className="stat-card hover-lift">
                    <div className="stat-icon bg-blue-100 text-blue-600">
                        <span className="material-icons-outlined">group</span>
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{loading ? '...' : stats?.active_users || 0}</div>
                        <div className="stat-label">Active Users</div>
                    </div>
                </Card>

                <Card className="stat-card hover-lift">
                    <div className="stat-icon bg-green-100 text-green-600">
                        <span className="material-icons-outlined">medical_services</span>
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{loading ? '...' : stats?.active_doctors || 0}</div>
                        <div className="stat-label">Active Doctors</div>
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
                            <h2>Admin Actions</h2>
                        </div>
                        <div className="quick-actions-grid">
                            <Card className="action-card hover-lift">
                                <span className="material-icons-outlined action-icon">verified</span>
                                <span>Verify Doctors</span>
                            </Card>
                            <Card className="action-card hover-lift">
                                <span className="material-icons-outlined action-icon">manage_accounts</span>
                                <span>Manage Users</span>
                            </Card>
                            <Card className="action-card hover-lift">
                                <span className="material-icons-outlined action-icon">security</span>
                                <span>Security Logs</span>
                            </Card>
                            <Card className="action-card hover-lift">
                                <span className="material-icons-outlined action-icon">settings_applications</span>
                                <span>System Config</span>
                            </Card>
                        </div>
                    </section>

                    <section className="dashboard-section">
                        <div className="section-header">
                            <h2>System Health</h2>
                        </div>
                        <Card className="health-tip-card" style={{ background: 'linear-gradient(135deg, var(--bg-surface-hover) 0%, var(--bg-surface) 100%)', border: '1px solid var(--border-default)' }}>
                            <div className="tip-content">
                                <h3 style={{ color: 'var(--text-primary)' }}>All Systems Operational</h3>
                                <p style={{ color: 'var(--text-secondary)' }}>
                                    {stats ? `${stats.total_patients} patients • ${stats.scheduled_appointments} scheduled` : 'Loading system metrics...'}
                                </p>
                            </div>
                            <span className="material-icons-outlined tip-icon" style={{ color: 'var(--color-success)' }}>check_circle</span>
                        </Card>
                    </section>
                </div>

                {/* Right: Activity Log */}
                <div className="side-column">
                    <section className="dashboard-section">
                        <div className="section-header">
                            <h2>Recent Activity</h2>
                            <Button variant="ghost" size="sm">View Log</Button>
                        </div>
                        <div className="appointment-list">
                            {loading ? (
                                <Card style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    Loading activity...
                                </Card>
                            ) : logs.length === 0 ? (
                                <Card style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    <span className="material-icons-outlined" style={{ fontSize: '48px', opacity: 0.5 }}>history</span>
                                    <p style={{ marginTop: '1rem' }}>No recent activity</p>
                                </Card>
                            ) : (
                                logs.map((log) => (
                                    <Card key={log.id} className="appointment-item hover-lift">
                                        <div className="appointment-date bg-gray-100 text-gray-600">
                                            <span className="day">{formatTime(log.created_at)}</span>
                                        </div>
                                        <div className="appointment-details">
                                            <h3>{log.action.replace('_', ' ')}</h3>
                                            <p>{log.user_name || 'System Action'}</p>
                                        </div>
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
