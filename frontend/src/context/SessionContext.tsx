import { createContext, useContext } from 'react';

interface SessionManagerContextValue {
    extendSession: () => void;
}

export const SessionManagerContext = createContext<SessionManagerContextValue>({
    extendSession: () => { },
});

export const useSessionManager = () => useContext(SessionManagerContext);
