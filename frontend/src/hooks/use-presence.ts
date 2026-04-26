import { useContext } from 'react';
import { PresenceContext } from '../context/presence-context-def';

export const usePresence = () => {
    const context = useContext(PresenceContext);
    if (context === undefined) {
        throw new Error('usePresence must be used within a PresenceProvider');
    }
    return context;
};
