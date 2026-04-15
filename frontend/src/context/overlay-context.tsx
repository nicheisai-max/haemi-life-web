import React, { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { logger } from '@/utils/logger';
import { OverlayContext } from './overlay-context-registry';
import type { ActiveOverlay } from './overlay-context-registry';


/**
 * 🩺 HAEMI LIFE | OVERLAY ORCHESTRATION PROVIDER
 * Standard: Google/Meta Grade TypeScript (Component Isolation)
 * Goal: Manage mutual exclusion for dashboard widgets without React Refresh warnings.
 */

export const OverlayProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>('none');

    const setOverlay = useCallback((overlay: ActiveOverlay) => {
        logger.debug('[OverlayContext] Orchestrating active overlay shift:', {
            from: activeOverlay,
            to: overlay
        });
        setActiveOverlay(overlay);
    }, [activeOverlay]);

    const closeOverlay = useCallback(() => {
        if (activeOverlay !== 'none') {
            logger.debug('[OverlayContext] Closing active overlay:', { activeOverlay });
            setActiveOverlay('none');
        }
    }, [activeOverlay]);

    return (
        <OverlayContext.Provider value={{ activeOverlay, setOverlay, closeOverlay }}>
            {children}
        </OverlayContext.Provider>
    );
};
