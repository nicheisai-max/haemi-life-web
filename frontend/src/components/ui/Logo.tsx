import React from 'react';
import logoImg from '../../assets/images/haemi_life_logo.png';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
    className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', className = '' }) => {
    const heightMap = {
        sm: '24px',
        md: '32px',
        lg: '64px',
        xl: '96px',
        xxl: '128px'
    };

    return (
        <div id="haemi-official-logo" className={`official-logo-root ${className}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
                src={logoImg}
                alt="Haemi Life"
                loading="eager"
                style={{
                    height: heightMap[size as keyof typeof heightMap] || '32px',
                    width: 'auto',
                    display: 'block',
                    pointerEvents: 'none'
                }}
            />
        </div>
    );
};
