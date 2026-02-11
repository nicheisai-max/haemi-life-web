import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop component ensures that the scroll position is reset to (0, 0)
 * whenever the route changes. This is a critical feature for production-grade
 * Single Page Applications (SPAs) to prevent scroll position carry-over.
 */
export const ScrollToTop = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo({
            top: 0,
            left: 0,
            behavior: 'instant' // Instant is preferred for SPAs to avoid jerky "auto-scrolling" feel
        });
    }, [pathname]);

    return null;
};
