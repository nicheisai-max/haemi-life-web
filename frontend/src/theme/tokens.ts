// Single Source of Truth for JS/TS usage (Charts, dynamic styles)
// These match frontend/src/styles/variables.css

export const theme = {
    brand: {
        primary: '#0284C7',
        primaryDark: '#0369A1',
        primaryLight: '#E0F2FE',
        secondary: '#0D9488',
        secondaryDark: '#0F766E',
        secondaryLight: '#F0FDFA',
        accent: '#6366F1',
    },
    text: {
        primary: '#0F172A',
        secondary: '#475569',
        muted: '#94A3B8',
        inverse: '#FFFFFF',
    },
    background: {
        body: '#F8FAFC',
        surface: '#FFFFFF',
        surfaceHover: '#F1F5F9',
    },
    status: {
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
    },
};

// Helper to get CSS variable value at runtime if needed
export const getCssVar = (name: string) => {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};
