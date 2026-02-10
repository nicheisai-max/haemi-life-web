import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';
import './Navbar.css';

export const Navbar: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [notifications] = useState([
        { text: 'Appointment confirmed with Dr. Smith', unread: true },
        { text: 'Prescription ready for pickup', unread: false },
        { text: 'Welcome to Haemi Life!', unread: false }
    ]);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <nav className="navbar">
            <div className="navbar-container">
                <div
                    className="navbar-brand"
                    onClick={() => navigate('/')}
                    role="button"
                    aria-label="Haemi Life Home"
                    tabIndex={0}
                    onKeyPress={(e) => e.key === 'Enter' && navigate('/')}
                >
                    <Logo size="md" />
                </div>

                <div className="navbar-actions">
                    {!isOnline && (
                        <div className="offline-indicator" role="status" aria-label="Offline Mode Active">
                            <span className="offline-dot"></span>
                            <span>OFFLINE MODE</span>
                        </div>
                    )}
                    <ThemeToggle />

                    {/* Notifications */}
                    <div className="navbar-item">
                        <button
                            className="icon-btn"
                            onClick={() => setShowNotifications(!showNotifications)}
                            aria-label={`${notifications.length} notifications`}
                            aria-haspopup="true"
                            aria-expanded={showNotifications}
                        >
                            <span className="material-icons-outlined">notifications</span>
                            <span className="badge">{notifications.length}</span>
                        </button>
                        {showNotifications && (
                            <div className="dropdown-menu notifications-menu" role="menu">
                                <div className="dropdown-header">Notifications</div>
                                {notifications.map((notif, idx) => (
                                    <div key={idx} className={`dropdown-item ${notif.unread ? 'unread' : ''}`} role="menuitem">
                                        {notif.text}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* User Profile */}
                    <div className="navbar-item">
                        <div
                            className="profile-widget"
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            role="button"
                            aria-label="User profile and settings"
                            aria-haspopup="true"
                            aria-expanded={showProfileMenu}
                            tabIndex={0}
                            onKeyPress={(e) => e.key === 'Enter' && setShowProfileMenu(!showProfileMenu)}
                        >
                            <div className="avatar">
                                {user?.name ? getInitials(user.name) : 'U'}
                            </div>
                            <div className="user-info">
                                <span className="user-name">{user?.name}</span>
                                <span className="user-role">{user?.role}</span>
                            </div>
                            <span className="material-icons-outlined">expand_more</span>
                        </div>

                        {showProfileMenu && (
                            <div className="dropdown-menu profile-menu">
                                <div className="dropdown-item" onClick={() => navigate('/profile')}>
                                    <span className="material-icons-outlined">person</span>
                                    My Profile
                                </div>
                                <div className="dropdown-item" onClick={() => navigate('/settings')}>
                                    <span className="material-icons-outlined">settings</span>
                                    Settings
                                </div>
                                <div className="dropdown-divider"></div>
                                <div className="dropdown-item text-danger" onClick={handleLogout}>
                                    <span className="material-icons-outlined">logout</span>
                                    Logout
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};
