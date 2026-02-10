import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getAllUsers, updateUserStatus } from '../../services/admin.service';
import type { UserManagement } from '../../services/admin.service';
import './UserManagement.css';

export const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<UserManagement[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<UserManagement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [searchTerm, roleFilter, users]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await getAllUsers();
            setUsers(data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = users;

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(user =>
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.phone_number.includes(searchTerm)
            );
        }

        // Role filter
        if (roleFilter !== 'all') {
            filtered = filtered.filter(user => user.role === roleFilter);
        }

        setFilteredUsers(filtered);
    };

    const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
        try {
            setProcessing(userId);
            await updateUserStatus(userId, { is_active: !currentStatus });
            await fetchUsers();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to update user status');
        } finally {
            setProcessing(null);
        }
    };

    if (loading) {
        return (
            <div className="user-management-container">
                <Card style={{ padding: '2rem', textAlign: 'center' }}>
                    <div className="loading-spinner">Loading users...</div>
                </Card>
            </div>
        );
    }

    return (
        <div className="user-management-container fade-in">
            <div className="page-header">
                <div>
                    <h1>User Management</h1>
                    <p>Manage user accounts and permissions</p>
                </div>
                <div className="stats-row">
                    <div className="stat-item">
                        <span className="stat-value">{users.length}</span>
                        <span className="stat-label">Total Users</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">{users.filter(u => u.is_active).length}</span>
                        <span className="stat-label">Active</span>
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

            {/* Filters */}
            <Card className="filters-card">
                <div className="search-box">
                    <span className="material-icons-outlined">search</span>
                    <input
                        type="text"
                        placeholder="Search by name, email, or phone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
                <div className="role-filters">
                    {['all', 'patient', 'doctor', 'admin', 'pharmacist'].map(role => (
                        <button
                            key={role}
                            className={`role-filter-btn ${roleFilter === role ? 'active' : ''}`}
                            onClick={() => setRoleFilter(role)}
                        >
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                        </button>
                    ))}
                </div>
            </Card>

            {/* Users Table */}
            <Card className="users-table-card">
                <div className="table-wrapper">
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Role</th>
                                <th>Contact</th>
                                <th>Joined</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                                        <span className="material-icons-outlined" style={{ fontSize: '48px', opacity: 0.3 }}>
                                            people_off
                                        </span>
                                        <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                                            No users match your filters
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id}>
                                        <td>
                                            <div className="user-cell">
                                                <div className="user-avatar">
                                                    <span className="material-icons-outlined">person</span>
                                                </div>
                                                <div>
                                                    <div className="user-name">{user.name}</div>
                                                    <div className="user-email">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`role-badge role-${user.role}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="contact-cell">{user.phone_number}</td>
                                        <td className="date-cell">
                                            {new Date(user.created_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </td>
                                        <td>
                                            <span className={`status-badge ${user.is_active ? 'status-active' : 'status-inactive'}`}>
                                                {user.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <Button
                                                variant={user.is_active ? "outline" : "primary"}
                                                size="sm"
                                                onClick={() => handleToggleStatus(user.id, user.is_active)}
                                                disabled={processing === user.id}
                                            >
                                                {user.is_active ? 'Deactivate' : 'Activate'}
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
