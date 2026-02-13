import React from 'react';
import Lottie from 'lottie-react';
import loaderAnimation from '../../assets/haemi_life_loader_optimized.json';
import { cn } from '@/lib/utils'; // Assuming this utility exists

/**
 * Haemi Life Official Global Loader – Do Not Replace.
 *
 * This component renders the brand-approved Lottie animation.
 * It is the SINGLE SOURCE OF TRUTH for all loading states in the application.
 */

interface LoaderProps {
    className?: string;
    variant?: 'fullscreen' | 'inline' | 'overlay';
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const Loader: React.FC<LoaderProps> = ({
    className,
    variant = 'inline',
    size = 'md',
}) => {
    const sizeClasses = {
        xs: 'w-5 h-5',
        sm: 'w-16 h-16',
        md: 'w-32 h-32',
        lg: 'w-48 h-48',
        xl: 'w-64 h-64',
    };

    const containerClasses = {
        fullscreen: 'fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm',
        overlay: 'absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm',
        inline: 'flex items-center justify-center',
    };

    return (
        <div
            role="status"
            aria-busy="true"
            className={cn(containerClasses[variant], className)}
        >
            <div className={cn(sizeClasses[size])}>
                <Lottie
                    animationData={loaderAnimation}
                    loop={true}
                    autoplay={true}
                    style={{ width: '100%', height: '100%' }}
                />
            </div>
            <span className="sr-only">Loading...</span>
        </div>
    );
};
