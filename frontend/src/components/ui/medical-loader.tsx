import React from 'react';
import { createPortal } from 'react-dom';
import { Logo } from './logo';
import { cn } from '@/lib/utils';

interface MedicalLoaderProps {
    message?: string;
    /**
     * 🧬 INSTITUTIONAL CENTERING VARIANTS
     * global: Uses 'fixed inset-0' via React Portal for absolute viewport dominance (End-to-End).
     * viewport: Uses 'absolute inset-0' for localized container-bound centering.
     */
    variant?: 'global' | 'viewport';
    className?: string;
}

export const MedicalLoader: React.FC<MedicalLoaderProps> = ({
    message = "Securing clinical data...",
    variant = 'global',
    className
}) => {
    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

    const content = (
        <div className={cn(
            "flex flex-col items-center justify-center gap-[2.5rem] text-center animate-in fade-in zoom-in-95 duration-500",
            className
        )}>
            <div className="relative">
                {/* Subtle Glow Background: Institutional standard for depth */}
                <div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full scale-150 animate-pulse functionality-reduced-motion:animate-none" />

                {/* Main Logo Container: Mirrored symmetry logic */}
                <div className="relative bg-background rounded-[calc(var(--card-radius)*0.5)] p-6 border border-border shadow-2xl ring-1 ring-black/5">
                    <Logo size="auth" />
                </div>

                {/* Status Indicator (Subtle Pulse) */}
                <div className="absolute -bottom-2 -right-2 bg-background rounded-full p-2 shadow-lg border border-border flex items-center justify-center">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex flex-col items-center justify-center gap-2">
                    <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Haemi Life Core
                    </h3>
                    <div className="h-0.5 w-16 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm animate-pulse tracking-wide">
                    {message}
                </p>
            </div>
        </div>
    );

    // INSTITUTIONAL BACKDROP WRAPPER (100% Opaque - End to End)
    const wrapper = (
        <div className={cn(
            "z-[99998] flex items-center justify-center bg-background backdrop-blur-md",
            variant === 'global' 
                ? "fixed inset-0 w-screen h-[100dvh]" 
                : "absolute inset-0 w-full h-full"
        )}>
            {content}
        </div>
    );

    if (variant === 'global' && isBrowser) {
        return createPortal(wrapper, document.body);
    }

    return variant ? wrapper : content;
};
