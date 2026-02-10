import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/images/haemi_life_logo.png';
import { ThemeToggle } from '../ui/ThemeToggle';
import './Navbar.css';

export const Navbar: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);

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
                <div className="navbar-brand" onClick={() => navigate('/')}>
                    <img src={logo} alt="Haemi Life" className="navbar-logo" />
                </div>

                <div className="navbar-actions">
                    <ThemeToggle />

                    {/* Notifications */}
                    <div className="navbar-item">
                        <button
                            className="icon-btn"
                            onClick={() => setShowNotifications(!showNotifications)}
                        >
                            <span className="material-icons-outlined">notifications</span>
                            <span className="badge">3</span>
                        </button>
                        {showNotifications && (
                            <div className="dropdown-menu notifications-menu">
                                <div className="dropdown-header">Notifications</div>
                                <div className="dropdown-item unread">Appointment confirmed with Dr. Smith</div>
                                <div className="dropdown-item">Prescription ready for pickup</div>
                                <div className="dropdown-item">Welcome to Haemi Life!</div>
                            </div>
                        )}
                    </div>

                    {/* User Profile */}
                    <div className="navbar-item">
                        <div
                            className="profile-widget"
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
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
