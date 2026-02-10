import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { Button } from '../components/ui/Button';
import './SessionManager.css';

interface SessionManagerContextValue {
    extendSession: () => void;
}

const SessionManagerContext = createContext<SessionManagerContextValue>({
    extendSession: () => { },
});

export const useSessionManager = () => useContext(SessionManagerContext);

interface SessionManagerProviderProps {
    children: ReactNode;
}

const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const WARNING_TIME = 2 * 60 * 1000; // Show warning 2 minutes before expiry
const SESSION_DURATION = 60 * 60 * 1000; // 1 hour total session

export const SessionManagerProvider: React.FC<SessionManagerProviderProps> = ({ children }) => {
    const { isAuthenticated, logout } = useAuth();
    const [lastActivity, setLastActivity] = useState(Date.now());
    const [showWarning, setShowWarning] = useState(false);
    const [countdown, setCountdown] = useState(120); // 2 minutes in seconds

    const updateActivity = useCallback(() => {
        setLastActivity(Date.now());
        setShowWarning(false);
    }, []);

    const extendSession = useCallback(() => {
        updateActivity();
        setShowWarning(false);
    }, [updateActivity]);

    const handleLogout = useCallback(() => {
        logout();
        setShowWarning(false);
    }, [logout]);

    // Track user activity
    useEffect(() => {
        if (!isAuthenticated) return;

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

        events.forEach(event => {
            window.addEventListener(event, updateActivity);
        });

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, updateActivity);
            });
        };
    }, [isAuthenticated, updateActivity]);

    // Check for idle timeout
    useEffect(() => {
        if (!isAuthenticated) return;

        const interval = setInterval(() => {
            const now = Date.now();
            const timeSinceActivity = now - lastActivity;

            // Show warning 2 minutes before timeout
            if (timeSinceActivity >= IDLE_TIMEOUT - WARNING_TIME && !showWarning) {
                setShowWarning(true);
            }

            // Auto-logout after idle timeout
            if (timeSinceActivity >= IDLE_TIMEOUT) {
                handleLogout();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isAuthenticated, lastActivity, showWarning, handleLogout]);

    // Countdown timer for warning
    useEffect(() => {
        if (!showWarning) {
            setCountdown(120);
            return;
        }

        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    handleLogout();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [showWarning, handleLogout]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <SessionManagerContext.Provider value={{ extendSession }}>
            {children}

            {showWarning && (
                <div className="session-warning-overlay">
                    <div className="session-warning-modal">
                        <span className="material-icons-outlined warning-icon">schedule</span>
                        <h2>Session Expiring Soon</h2>
                        <p>
                            Your session will expire in <strong>{formatTime(countdown)}</strong> due to inactivity.
                        </p>
                        <p className="warning-subtext">
                            You will be automatically logged out for security reasons.
                        </p>
                        <div className="warning-actions">
                            <Button
                                variant="outline"
                                onClick={handleLogout}
                            >
                                Logout Now
                            </Button>
                            <Button
                                variant="primary"
                                onClick={extendSession}
                                leftIcon={<span className="material-icons-outlined">refresh</span>}
                            >
                                Stay Logged In
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </SessionManagerContext.Provider>
    );
};
