import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { changePassword } from '../../services/user.service';
import './Settings.css';

export const Settings: React.FC = () => {
    const { user } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            setSuccess(null);

            await changePassword({
                current_password: currentPassword,
                new_password: newPassword
            });

            setSuccess('Password changed successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="settings-container fade-in">
            <div className="settings-header">
                <h1>Settings</h1>
                <p>Manage your account preferences and security settings</p>
            </div>

            {error && (
                <Card className="alert alert-error">
                    <span className="material-icons-outlined">error</span>
                    {error}
                </Card>
            )}

            {success && (
                <Card className="alert alert-success">
                    <span className="material-icons-outlined">check_circle</span>
                    {success}
                </Card>
            )}

            <div className="settings-grid">
                {/* Account Information */}
                <Card className="settings-card">
                    <div className="card-header">
                        <h2>Account Information</h2>
                    </div>

                    <div className="account-summary">
                        <div className="summary-item">
                            <span className="material-icons-outlined">person</span>
                            <div>
                                <div className="summary-label">Name</div>
                                <div className="summary-value">{user?.name}</div>
                            </div>
                        </div>

                        <div className="summary-item">
                            <span className="material-icons-outlined">email</span>
                            <div>
                                <div className="summary-label">Email</div>
                                <div className="summary-value">{user?.email}</div>
                            </div>
                        </div>

                        <div className="summary-item">
                            <span className="material-icons-outlined">phone</span>
                            <div>
                                <div className="summary-label">Phone</div>
                                <div className="summary-value">{user?.phone_number}</div>
                            </div>
                        </div>

                        <div className="summary-item">
                            <span className="material-icons-outlined">badge</span>
                            <div>
                                <div className="summary-label">Role</div>
                                <div className="summary-value" style={{ textTransform: 'capitalize' }}>{user?.role}</div>
                            </div>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        fullWidth
                        leftIcon={<span className="material-icons-outlined">edit</span>}
                        onClick={() => window.location.href = '/profile'}
                    >
                        Edit Profile
                    </Button>
                </Card>

                {/* Change Password */}
                <Card className="settings-card">
                    <div className="card-header">
                        <h2>Change Password</h2>
                    </div>

                    <form onSubmit={handlePasswordChange} className="password-form">
                        <div className="form-group">
                            <label htmlFor="current-password">Current Password</label>
                            <input
                                type="password"
                                id="current-password"
                                className="form-input"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="new-password">New Password</label>
                            <input
                                type="password"
                                id="new-password"
                                className="form-input"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                autoComplete="new-password"
                                minLength={6}
                            />
                            <span className="form-hint">At least 6 characters</span>
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirm-password">Confirm New Password</label>
                            <input
                                type="password"
                                id="confirm-password"
                                className="form-input"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                autoComplete="new-password"
                            />
                        </div>

                        <Button
                            type="submit"
                            variant="primary"
                            fullWidth
                            disabled={loading}
                            leftIcon={loading ? undefined : <span className="material-icons-outlined">lock</span>}
                        >
                            {loading ? 'Updating...' : 'Update Password'}
                        </Button>
                    </form>
                </Card>

                {/* Preferences */}
                <Card className="settings-card">
                    <div className="card-header">
                        <h2>Preferences</h2>
                    </div>

                    <div className="preferences-list">
                        <div className="preference-item">
                            <div>
                                <div className="preference-label">Email Notifications</div>
                                <div className="preference-description">Receive appointment reminders via email</div>
                            </div>
                            <label className="toggle-switch">
                                <input type="checkbox" defaultChecked />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        <div className="preference-item">
                            <div>
                                <div className="preference-label">SMS Notifications</div>
                                <div className="preference-description">Receive SMS alerts for appointments</div>
                            </div>
                            <label className="toggle-switch">
                                <input type="checkbox" defaultChecked />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        <div className="preference-item">
                            <div>
                                <div className="preference-label">Marketing Updates</div>
                                <div className="preference-description">Stay informed about new features</div>
                            </div>
                            <label className="toggle-switch">
                                <input type="checkbox" />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        <div className="preference-item">
                            <div>
                                <div className="preference-label">Low Data Mode</div>
                                <div className="preference-description">Optimize for slow connections (reduces image quality)</div>
                            </div>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    defaultChecked={localStorage.getItem('lowDataMode') === 'true'}
                                    onChange={(e) => {
                                        localStorage.setItem('lowDataMode', e.target.checked.toString());
                                        setTimeout(() => window.location.reload(), 300);
                                    }}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
