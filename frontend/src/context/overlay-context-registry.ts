import { createContext } from 'react';

/**
 * 🩺 HAEMI LIFE | OVERLAY SYSTEM REGISTRY
 * Standard: Google/Meta Grade TypeScript (Pure Data Isolation)
 * Goal: Resolve Fast Refresh constraints by isolating context from components.
 */

export type ActiveOverlay = 'none' | 'user-menu' | 'notifications' | 'chat' | 'copilot';

export interface OverlayContextType {
    activeOverlay: ActiveOverlay;
    setOverlay: (overlay: ActiveOverlay) => void;
    closeOverlay: () => void;
}

export const OverlayContext = createContext<OverlayContextType | undefined>(undefined);
