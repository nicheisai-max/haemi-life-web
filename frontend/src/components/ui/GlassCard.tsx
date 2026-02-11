import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from './card';
import { GradientMesh } from './GradientMesh';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    mesh?: boolean;
    meshVariant?: 'primary' | 'secondary' | 'accent' | 'subtle';
    hoverEffect?: boolean;
    children?: React.ReactNode;
}

/**
 * GlassCard - A premium card component with glassmorphism effects
 * (backdrop-blur, transparency, and optional mesh backgrounds).
 */
export const GlassCard: React.FC<GlassCardProps> = ({
    className,
    children,
    mesh = false,
    meshVariant = 'subtle',
    hoverEffect = true,
    ...props
}) => {
    return (
        <Card
            className={cn(
                "relative overflow-hidden bg-background/60 backdrop-blur-xl border-border/40 shadow-xl",
                hoverEffect && "transition-all duration-300 hover:shadow-2xl hover:bg-background/80 hover:border-primary/20 hover:-translate-y-1",
                className
            )}
            {...props}
        >
            {mesh && <GradientMesh variant={meshVariant} className="opacity-40" />}
            <div className="relative z-10">
                {children}
            </div>
        </Card>
    );
};
