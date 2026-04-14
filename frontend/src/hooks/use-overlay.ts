import { useContext } from 'react';
import { OverlayContext } from '../context/overlay-context-registry';

/**
 * useOverlay Hook
 * 🩺 HAEMI LIFE | Modular Overlay Orchestration
 * Provides safe access to the OverlayContext for managing dashboard state.
 * Standards: Google/Meta-grade TypeScript, Strict Hook Pattern.
 */
export const useOverlay = () => {
    const context = useContext(OverlayContext);
    if (!context) {
        throw new Error('useOverlay must be used within an OverlayProvider');
    }
    return context;
};
