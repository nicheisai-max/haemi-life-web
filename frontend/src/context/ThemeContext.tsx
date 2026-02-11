import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(() => {
        // Detect if we are on an auth page to force light initial state
        const path = window.location.pathname;
        const isAuthPage = path.includes('/login') || path.includes('/signup') || path.includes('/forgot-password');

        if (isAuthPage) return 'light';

        // Check local storage or system preference
        const savedTheme = localStorage.getItem('theme') as Theme;
        if (savedTheme) return savedTheme;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    // We need location to react to route changes
    const [path, setPath] = useState(window.location.pathname);

    // Listen for route changes manually since ThemeProvider is outside Router in App.tsx
    // (Wait, actually ThemeProvider is INSIDE Router in App.tsx? No, let's check App.tsx)
    // In App.tsx: Router is inside AppRoutes? No, Router wraps AppRoutes. 
    // Wait, App.tsx has Router inside. ThemeProvider is OUTSIDE Router.
    // So we can't use useLocation here. We'll use a simple event listener or just check on every render.

    useEffect(() => {
        const root = window.document.documentElement;

        // Check current path
        const currentPath = window.location.pathname;
        const isAuthPage = currentPath.includes('/login') ||
            currentPath.includes('/signup') ||
            currentPath.includes('/forgot-password') ||
            currentPath.includes('/onboarding');

        const activeTheme = isAuthPage ? 'light' : theme;

        root.classList.remove('light', 'dark');
        root.classList.add(activeTheme);

        if (!isAuthPage) {
            localStorage.setItem('theme', theme);
        }

        // Add a global listener for navigation jerks if needed, but this should suffice 
        // if we also listen to popstate or just handle it in the component.
        const handleLocationChange = () => {
            setPath(window.location.pathname);
        };

        window.addEventListener('popstate', handleLocationChange);
        // Also listen for our own link clicks
        window.addEventListener('pushstate', handleLocationChange);
        window.addEventListener('replacestate', handleLocationChange);

        return () => {
            window.removeEventListener('popstate', handleLocationChange);
            window.removeEventListener('pushstate', handleLocationChange);
            window.removeEventListener('replacestate', handleLocationChange);
        };
    }, [theme, path]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
