import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { ThemeContext, type Theme } from './theme-context-def';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();

    // Function to check if current page is an auth page
    const isAuthPage = (pathname: string) => {
        return pathname.includes('/login') ||
            pathname.includes('/signup') ||
            pathname.includes('/forgot-password') ||
            pathname.includes('/onboarding');
    };

    const [theme, setTheme] = useState<Theme>(() => {
        // Initial check relies on window.location since useLocation might not be ready during initial state setup? 
        // Actually it is, but let's be safe.
        if (isAuthPage(window.location.pathname)) return 'light';

        const savedTheme = sessionStorage.getItem('theme') as Theme;
        if (savedTheme) return savedTheme;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    useEffect(() => {
        const root = window.document.documentElement;

        // If it's an auth page, FORCE 'light' regardless of 'theme' state
        if (isAuthPage(location.pathname)) {
            root.classList.remove('dark');
            root.classList.add('light');
            // We don't update setItem here to preserve user preference when they leave auth pages
        } else {
            root.classList.remove('light', 'dark');
            root.classList.add(theme);
            sessionStorage.setItem('theme', theme);
        }

    }, [theme, location.pathname]);

    const toggleTheme = useCallback(() => {
        if (isAuthPage(location.pathname)) return; // Prevent toggling on auth pages

        // Google/GitHub pattern: flash .theme-transitioning for 200ms ONLY
        const root = window.document.documentElement;
        root.classList.add('theme-transitioning');
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
        window.setTimeout(() => root.classList.remove('theme-transitioning'), 310);
    }, [location.pathname]);

    const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

// ThemeContext and useTheme moved to ThemeContextDef.ts and useTheme.ts to satisfy Fast Refresh rules.
