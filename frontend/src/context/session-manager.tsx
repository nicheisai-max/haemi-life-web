import React, { useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from '../hooks/use-auth';
import { SessionManagerContext } from './session-context';

interface SessionManagerProviderProps {
    children: ReactNode;
}

// NO HARDCODED TIMEOUTS (Enterprise Requirement)
// Session authority now resides exclusively on the backend.

export const SessionManagerProvider: React.FC<SessionManagerProviderProps> = ({ children }) => {
    const { isAuthenticated } = useAuth();

    const extendSession = useCallback(() => {
        // Heartbeat is handled by api.ts interceptors and AuthContext proactive refresh.
        // This remains as a placeholder for manual extension if needed.
    }, []);


    // Track user activity (Used to keep local state fresh, but server drives expiry)
    useEffect(() => {
        if (!isAuthenticated) return;

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

        const handleUserActivity = () => {
            // No longer forcing a local idle timeout here.
            // The AuthContext heartbeat and Refresh engine handle token freshness.
        };

        events.forEach(event => {
            window.addEventListener(event, handleUserActivity);
        });

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, handleUserActivity);
            });
        };
    }, [isAuthenticated]);

    // Removal of hardcoded periodic idle check.
    // The system now trusts the Server/Middleware to return 401 if the 1440m (Admin-set) threshold is met.


    return (
        <SessionManagerContext.Provider value={{ extendSession }}>
            {children}
        </SessionManagerContext.Provider>
    );
};
