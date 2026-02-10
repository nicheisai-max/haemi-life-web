import React from 'react';

export const Logo: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
    const sizes = {
        sm: { fontSize: '1.25rem' },
        md: { fontSize: '1.5rem' },
        lg: { fontSize: '2rem' },
    };

    return (
        <div style={{ ...sizes[size], fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
                width: '1em',
                height: '1em',
                backgroundColor: 'var(--color-primary)',
                borderRadius: 'var(--radius-sm)',
                display: 'grid',
                placeItems: 'center',
                color: 'white',
                fontSize: '0.6em',
                lineHeight: 1
            }}>
                +
            </div>
            <span style={{ color: 'var(--color-slate-900)' }}>
                Haemi<span style={{ color: 'var(--color-primary)' }}>Life</span>
            </span>
        </div>
    );
};
