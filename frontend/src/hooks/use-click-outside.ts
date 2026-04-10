import { useEffect, useRef } from 'react';

type Handler = (event: MouseEvent | TouchEvent | PointerEvent) => void;

export const useClickOutside = <T extends Element>(
    handler: Handler,
    ignoredRefs: readonly React.RefObject<Element | null>[] = [],
    enabled: boolean = true
) => {
    const ref = useRef<T>(null);
    const savedHandler = useRef(handler);
    const savedIgnoredRefs = useRef(ignoredRefs);
    const savedEnabled = useRef(enabled);

    // Update saved handler and ignored refs to always use latest props without recycling the listener
    useEffect(() => {
        savedHandler.current = handler;
        savedIgnoredRefs.current = ignoredRefs;
        savedEnabled.current = enabled;
    }, [handler, ignoredRefs, enabled]);

    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent | PointerEvent) => {
            if (!savedEnabled.current) return;
            const target = event.target as Node;

            // Do nothing if clicking ref's element or descendent elements
            if (!ref.current || ref.current.contains(target)) {
                return;
            }

            // Do nothing if clicking any interaction targets we want to ignore (like trigger buttons)
            for (const ignoredRef of savedIgnoredRefs.current) {
                if (ignoredRef.current && ignoredRef.current.contains(target)) {
                    return;
                }
            }

            // 🩺 HAEMI GLOBAL IGNORE PROTOCOL
            // If the element (or any of its parents) is specifically marked to be ignored
            // by a global orchestration event, we skip the closure logic.
            if (target instanceof Element && target.closest('.haemi-ignore-click-outside')) {
                return;
            }

            // Defer execution by 0ms to push it to the end of the event loop,
            // allowing React's internal Synthetic `onClick` events to clear first.
            // This surgically eliminates the 488ms "Forced Reflow" Violation.
            setTimeout(() => {
                savedHandler.current(event);
            }, 0);
        };

        // Use Capture Phase to ensure we catch events before stopPropagation() can block them
        // 🩺 PERFORMANCE OPTIMIZATION: { passive: true } prevents main-thread blocking
        const options = { capture: true, passive: true };
        document.addEventListener('pointerdown', listener, options);

        return () => {
            document.removeEventListener('pointerdown', listener, options);
        };
    }, []); // Empty dependency array properly stabilizes the listener

    return ref;
};
