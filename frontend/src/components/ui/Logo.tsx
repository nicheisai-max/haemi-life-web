import React from 'react';
import logoImg from '../../assets/images/haemi_life_logo.png';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', className = '' }) => {
    const heightMap = {
        sm: '24px',
        md: '32px',
        lg: '48px',
    };

    return (
        <div className={`logo-container ${className}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <img
                src={logoImg}
                alt="Haemi Life"
                style={{ height: heightMap[size], width: 'auto', objectFit: 'contain' }}
            />
        </div>
    );
};
