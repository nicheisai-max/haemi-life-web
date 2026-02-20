import React from 'react';
import logoImg from '../../assets/images/haemi_life_logo.png';

interface LogoProps {
    size?: 'sm' | 'md' | 'nav' | 'auth' | 'lg' | 'xl' | 'xxl';
    className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', className = '' }) => {
    const heightMap = {
        sm: '28px',
        md: '32px',
        nav: '48px',
        auth: '60px',
        lg: '64px',
        xl: '96px',
        xxl: '128px'
    };

    return (
        <div id="haemi-official-logo" className={`official-logo-root inline-flex items-center justify-center ${className}`}>
            <img
                src={logoImg}
                alt="Haemi Life"
                loading="eager"
                className="transition-all duration-300 dark:drop-shadow-[0_0_15px_rgba(63,194,181,0.5)] filter drop-shadow-sm block pointer-events-none"
                style={{
                    height: heightMap[size as keyof typeof heightMap] || '40px',
                    width: 'auto',
                }}
            />
        </div>
    );
};
