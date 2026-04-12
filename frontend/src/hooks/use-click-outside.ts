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

            // 🩺 HAEMI STABILITY GUARD: If target is no longer in document, skip (Prevents race conditions)
            if (!target || !document.body.contains(target)) return;

            // Do nothing if clicking ref's element or descendent elements
            if (!ref.current || ref.current.contains(target)) {
                return;
            }

            // Do nothing if clicking any interaction targets we want to ignore
            for (const ignoredRef of savedIgnoredRefs.current) {
                if (ignoredRef.current && ignoredRef.current.contains(target)) {
                    return;
                }
            }

            // 🩺 HAEMI GLOBAL IGNORE PROTOCOL
            if (target instanceof Element && target.closest('.haemi-ignore-click-outside')) {
                return;
            }

            // Defer execution by 0ms to allow React's internal events to process
            setTimeout(() => {
                try {
                    // Final sanity check before calling handler
                    if (ref.current && savedEnabled.current) {
                        savedHandler.current(event);
                    }
                } catch (error) {
                    console.error('[HaemiClickOutside] Handler crashed safely intercepted:', error);
                }
            }, 0);
        };

        const options = { capture: true, passive: true };
        document.addEventListener('pointerdown', listener, options);

        return () => {
            document.removeEventListener('pointerdown', listener, options);
        };
    }, []); // Empty dependency array properly stabilizes the listener

    return ref;
};
