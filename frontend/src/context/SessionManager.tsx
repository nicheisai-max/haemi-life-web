import React, { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Clock, RotateCw } from 'lucide-react';
import { SessionManagerContext } from './SessionContext';

interface SessionManagerProviderProps {
    children: ReactNode;
}


const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const WARNING_TIME = 2 * 60 * 1000; // Show warning 2 minutes before expiry
// Session duration constant moved or unused
// const SESSION_DURATION = 60 * 60 * 1000; // 1 hour total session

export const SessionManagerProvider: React.FC<SessionManagerProviderProps> = ({ children }) => {
    const { isAuthenticated, logout } = useAuth();
    const [lastActivity, setLastActivity] = useState(() => Date.now());
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

    const handleLogout = useCallback(async () => {
        await logout();
        setShowWarning(false);
        // Manual navigate removed: Relying on AuthContext state-driven routing.
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

    const hasResetOnAuth = useRef(false);

    // P1 FIX: Reset idle timer the moment user becomes authenticated.
    useEffect(() => {
        if (isAuthenticated) {
            if (!hasResetOnAuth.current) {
                Promise.resolve().then(() => {
                    setLastActivity(Date.now());
                    setShowWarning(false);
                });
                hasResetOnAuth.current = true;
            }
        } else {
            hasResetOnAuth.current = false;
        }
    }, [isAuthenticated]);

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
            Promise.resolve().then(() => {
                setCountdown(120);
            });
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
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-[90%] max-w-[400px] bg-background rounded-xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200 border border-border">
                        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
                            <Clock className="h-8 w-8 text-amber-600 dark:text-amber-500" />
                        </div>
                        <h2 className="text-xl font-semibold mb-2 text-foreground">Session Expiring Soon</h2>
                        <p className="text-muted-foreground mb-4">
                            Your session will expire in <strong className="text-foreground">{formatTime(countdown)}</strong> due to inactivity.
                        </p>
                        <p className="text-sm text-muted-foreground/80 mb-6">
                            You will be automatically logged out for security reasons.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Button
                                variant="outline"
                                onClick={handleLogout}
                                className="w-full sm:w-auto"
                            >
                                Logout Now
                            </Button>
                            <Button
                                variant="default"
                                onClick={extendSession}
                                className="w-full sm:w-auto flex items-center gap-2"
                            >
                                <RotateCw className="h-4 w-4" />
                                Extend Session
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </SessionManagerContext.Provider>
    );
};
