import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getProfile, updateProfile } from '../../services/user.service';
import type { UserProfile, UpdateProfileData } from '../../services/user.service';
import { CardSkeleton } from '../../components/loaders/SkeletonLoader';
import './Profile.css';

export const Profile: React.FC = () => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [formData, setFormData] = useState<UpdateProfileData>({
        name: '',
        email: '',
        phone_number: ''
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const data = await getProfile();
            setProfile(data);
            setFormData({
                name: data.name,
                email: data.email,
                phone_number: data.phone_number
            });
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            setSuccess(null);
            await updateProfile(formData);
            await fetchProfile();
            setSuccess('Profile updated successfully!');
            setEditing(false);
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setFormData({
            name: profile?.name || '',
            email: profile?.email || '',
            phone_number: profile?.phone_number || ''
        });
        setEditing(false);
        setError(null);
    };

    if (loading) {
        return (
            <div className="profile-container">
                <div className="profile-grid">
                    <CardSkeleton />
                    <CardSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div className="profile-container fade-in">
            <div className="profile-header">
                <h1>My Profile</h1>
                <p>Manage your personal information and account settings</p>
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

            <div className="profile-grid">
                {/* Left: Profile Info */}
                <Card className="profile-card">
                    <div className="card-header">
                        <h2>Personal Information</h2>
                        {!editing && (
                            <Button
                                variant="outline"
                                size="sm"
                                leftIcon={<span className="material-icons-outlined">edit</span>}
                                onClick={() => setEditing(true)}
                            >
                                Edit
                            </Button>
                        )}
                    </div>

                    <div className="profile-form">
                        <div className="form-group">
                            <label htmlFor="name">Full Name</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                className="form-input"
                                value={formData.name}
                                onChange={handleInputChange}
                                disabled={!editing}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                className="form-input"
                                value={formData.email}
                                onChange={handleInputChange}
                                disabled={!editing}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="phone_number">Phone Number</label>
                            <input
                                type="tel"
                                id="phone_number"
                                name="phone_number"
                                className="form-input"
                                value={formData.phone_number}
                                onChange={handleInputChange}
                                disabled={!editing}
                            />
                        </div>

                        {editing && (
                            <div className="form-actions">
                                <Button
                                    variant="outline"
                                    onClick={handleCancel}
                                    disabled={saving}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handleSave}
                                    disabled={saving}
                                    leftIcon={saving ? undefined : <span className="material-icons-outlined">save</span>}
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Right: Account Info */}
                <Card className="account-card">
                    <div className="card-header">
                        <h2>Account Details</h2>
                    </div>

                    <div className="account-info">
                        <div className="info-item">
                            <span className="material-icons-outlined">badge</span>
                            <div>
                                <div className="info-label">Role</div>
                                <div className="info-value">{profile?.role}</div>
                            </div>
                        </div>

                        <div className="info-item">
                            <span className="material-icons-outlined">event</span>
                            <div>
                                <div className="info-label">Member Since</div>
                                <div className="info-value">
                                    {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    }) : 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div className="info-item">
                            <span className="material-icons-outlined">verified_user</span>
                            <div>
                                <div className="info-label">Account Status</div>
                                <div className={`info-value status-${profile?.is_active ? 'active' : 'inactive'}`}>
                                    {profile?.is_active ? 'Active' : 'Inactive'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="quick-actions">
                        <h3>Quick Actions</h3>
                        <Button
                            variant="ghost"
                            fullWidth
                            leftIcon={<span className="material-icons-outlined">settings</span>}
                            onClick={() => window.location.href = '/settings'}
                        >
                            Account Settings
                        </Button>
                        <Button
                            variant="ghost"
                            fullWidth
                            leftIcon={<span className="material-icons-outlined">lock</span>}
                            onClick={() => window.location.href = '/settings'}
                        >
                            Change Password
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
};
