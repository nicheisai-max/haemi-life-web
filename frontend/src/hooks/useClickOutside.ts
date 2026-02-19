import { useEffect, useRef } from 'react';

type Handler = (event: MouseEvent | TouchEvent | PointerEvent) => void;

export const useClickOutside = <T extends HTMLElement>(
    handler: Handler,
    ignoredRefs: React.RefObject<HTMLElement>[] = []
) => {
    const ref = useRef<T>(null);
    const savedHandler = useRef(handler);

    // Update saved handler execution to always use latest prop
    useEffect(() => {
        savedHandler.current = handler;
    }, [handler]);

    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent | PointerEvent) => {
            const target = event.target as Node;

            // Do nothing if clicking ref's element or descendent elements
            if (!ref.current || ref.current.contains(target)) {
                return;
            }

            // Do nothing if clicking any interaction targets we want to ignore (like trigger buttons)
            for (const ignoredRef of ignoredRefs) {
                if (ignoredRef.current && ignoredRef.current.contains(target)) {
                    return;
                }
            }

            savedHandler.current(event);
        };

        // Use Capture Phase to ensure we catch events before stopPropagation() can block them
        // Using pointerdown is more robust than mousedown for hybrid devices
        document.addEventListener('pointerdown', listener, true);

        return () => {
            document.removeEventListener('pointerdown', listener, true);
        };
    }, []); // Empty dependency array properly stabilizes the listener

    return ref;
};
