import React from 'react';
import { cn } from '@/lib/utils';

interface GradientMeshProps {
    className?: string;
    variant?: 'primary' | 'secondary' | 'accent' | 'subtle' | 'brand';
}

/**
 * GradientMesh - A component that creates a premium, atmospheric mesh background
 * inspired by modern high-end dashboards.
 */
export const GradientMesh: React.FC<GradientMeshProps> = ({
    className,
    variant = 'primary'
}) => {
    const variants = {
        primary: "from-indigo-500/10 via-purple-500/5 to-teal-500/10",
        secondary: "from-teal-500/10 via-emerald-500/5 to-indigo-500/10",
        accent: "from-rose-500/10 via-orange-500/5 to-amber-500/10",
        subtle: "from-slate-500/5 via-transparent to-slate-500/5",
        brand: "from-primary-800/10 via-primary-600/5 to-primary-400/10",
    };

    return (
        <div className={cn(
            "absolute inset-0 pointer-events-none overflow-hidden select-none z-0",
            className
        )}>
            {/* Base Mesh */}
            <div className={cn(
                "absolute inset-0 bg-gradient-to-br animate-in fade-in duration-1000",
                variants[variant]
            )} />

            {/* Animated Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-500/15 rounded-full blur-[100px] animate-pulse delay-700" />

            {/* Noise Overlay (Optional subtle texture) */}
            <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
        </div>
    );
};
