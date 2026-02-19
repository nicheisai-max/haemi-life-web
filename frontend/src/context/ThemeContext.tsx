import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

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

    const toggleTheme = () => {
        if (isAuthPage(location.pathname)) return; // Prevent toggling on auth pages
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
