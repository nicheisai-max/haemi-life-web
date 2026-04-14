import { useEffect, useRef } from 'react';
import { logger } from '../utils/logger';

type Handler = (event: MouseEvent | TouchEvent | PointerEvent) => void;

/**
 * 🩺 HAEMI LIFE | INSTITUTIONAL INTERACTION HOOK
 * Optimizes click-outside detection for medical dashboards.
 * Features: Started-outside validation, Capture-phase execution, Zero-lag orchestration.
 */
export const useClickOutside = <T extends Element>(
    handler: Handler,
    ignoredRefs: readonly React.RefObject<Element | null>[] = [],
    enabled: boolean = true
) => {
    const ref = useRef<T>(null);
    const savedHandler = useRef(handler);
    const savedIgnoredRefs = useRef(ignoredRefs);
    const savedEnabled = useRef(enabled);
    
    // Tracking start of the interaction to ensure robust "Complete-Click-Outside" validation
    const startedOutside = useRef(false);

    // Update saved state to ensure latest props without recycled listeners
    useEffect(() => {
        savedHandler.current = handler;
        savedIgnoredRefs.current = ignoredRefs;
        savedEnabled.current = enabled;
    }, [handler, ignoredRefs, enabled]);

    useEffect(() => {
        const handleStart = (event: PointerEvent) => {
            if (!savedEnabled.current) return;
            const target = event.target as Node;

            // Check if interaction started inside the primary container or ignored refs
            const isInsidePrimary = ref.current && ref.current.contains(target);
            let isInsideIgnored = false;
            
            for (const ignoredRef of savedIgnoredRefs.current) {
                if (ignoredRef.current && ignoredRef.current.contains(target)) {
                    isInsideIgnored = true;
                    break;
                }
            }

            // Global protocol check
            const isIgnoredClass = target instanceof Element && target.closest('.haemi-ignore-click-outside');

            startedOutside.current = !isInsidePrimary && !isInsideIgnored && !isIgnoredClass;
        };

        const handleEnd = (event: PointerEvent) => {
            if (!savedEnabled.current || !startedOutside.current) return;
            const target = event.target as Node;

            // Validation: Interaction must persist as "Outside" during the entire lifecycle
            if (!target || !document.body.contains(target)) return;

            // Final containment check for the end-target
            const isInsidePrimary = ref.current && ref.current.contains(target);
            let isInsideIgnored = false;
            
            for (const ignoredRef of savedIgnoredRefs.current) {
                if (ignoredRef.current && ignoredRef.current.contains(target)) {
                    isInsideIgnored = true;
                    break;
                }
            }

            const isIgnoredClass = target instanceof Element && target.closest('.haemi-ignore-click-outside');

            if (!isInsidePrimary && !isInsideIgnored && !isIgnoredClass) {
                try {
                    // P0 STABILITY: Atomic execution without event-loop delay
                    savedHandler.current(event);
                } catch (error) {
                    logger.error('[HaemiClickOutside] Orchestration failed safely:', { 
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }
        };

        const options = { capture: true, passive: true };
        
        // Listen for pointer events (Unified Mouse/Touch standard)
        document.addEventListener('pointerdown', handleStart, options);
        document.addEventListener('pointerup', handleEnd, options);

        return () => {
            document.removeEventListener('pointerdown', handleStart, options);
            document.removeEventListener('pointerup', handleEnd, options);
        };
    }, []); // Empty dependency array stabilizes the listeners

    return ref;
};
