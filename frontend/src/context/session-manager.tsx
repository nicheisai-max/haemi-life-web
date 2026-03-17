import React, { useCallback, type ReactNode } from 'react';
import { SessionManagerContext } from './session-context';
import { SessionExpiringPopup } from '@/components/auth/session-expiring-popup';
import { performRefresh } from '@/services/api';

interface SessionManagerProviderProps {
    children: ReactNode;
}

export const SessionManagerProvider: React.FC<SessionManagerProviderProps> = ({ children }) => {
    const extendSession = useCallback(async () => {
        // Phase 3: Extend session via centralized refresh logic which updates 
        // both memory tokens and backend sliding window.
        await performRefresh();
    }, []);

    return (
        <SessionManagerContext.Provider value={{ extendSession }}>
            {children}
            <SessionExpiringPopup onExtend={extendSession} />
        </SessionManagerContext.Provider>
    );
};
