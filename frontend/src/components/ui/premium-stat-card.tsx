import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from './card';
import { GradientMesh } from './gradient-mesh';
import type { LucideIcon } from 'lucide-react';

interface PremiumStatCardProps {
    icon: LucideIcon;
    label: string;
    value: React.ReactNode;
    subtext?: string;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    variant?: 'default' | 'gradient';
    className?: string;
    onClick?: () => void;
}

/**
 * PremiumStatCard - A high-end KPI card component following Google's UX principles.
 * Features:
 * - Proper spacing (Gap-4/6)
 * - Haemi Life Branded Gradients
 * - Clean Typography (Roboto)
 */
export const PremiumStatCard: React.FC<PremiumStatCardProps> = ({
    icon: Icon,
    label,
    value,
    subtext,
    trend,
    trendValue,
    variant = 'default',
    className,
    onClick
}) => {
    // Haemi Life Brand Gradient: Primary-800 -> Primary-600 -> Primary-400
    const brandGradient = "bg-gradient-to-br from-primary-800 via-primary-600 to-primary-400";

    // Subtle background for the 'default' variant card
    const cardBg = variant === 'default'
        ? "bg-white dark:bg-card border-slate-100 dark:border-border shadow-sm hover:shadow-md"
        : `${brandGradient} text-white border-none shadow-lg`;

    // Icon Styles
    const iconContainer = variant === 'default'
        ? `${brandGradient} text-white shadow-lg shadow-primary-600/20`
        : "bg-white/20 text-white backdrop-blur-md border border-white/20";

    return (
        <Card
            onClick={onClick}
            interactive={!!onClick}
            className={cn(
                "relative overflow-hidden group",
                "p-5 flex flex-col items-start gap-3",
                "rounded-card", // Slightly tighter radius
                cardBg,
                className
            )}
        >
            {/* Mesh Background for Default Variant */}
            {variant === 'default' && (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <GradientMesh variant="brand" className="opacity-30" />
                </div>
            )}

            {/* Icon Header */}
            <div className="flex items-start justify-between w-full">
                <div className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-xl shrink-0 transition-transform duration-300 group-hover:scale-110",
                    iconContainer
                )}>
                    <Icon className="h-6 w-6" />
                </div>

                {trend && (
                    <div className={cn(
                        "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full",
                        variant === 'gradient' ? "bg-white/20 text-white" :
                            trend === 'up' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                trend === 'down' ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" :
                                    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    )}>
                        {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '•'} {trendValue}
                    </div>
                )}
            </div>

            {/* Content with proper spacing */}
            <div className="space-y-1 mt-1">
                <p className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    variant === 'gradient' ? "text-white/80" : "text-muted-foreground"
                )}>
                    {label}
                </p>
                <h3 className={cn(
                    "text-h3 tracking-tight",
                    variant === 'gradient' ? "text-white" : "text-foreground"
                )}>
                    {value}
                </h3>
                {subtext && (
                    <p className={cn(
                        "text-xs font-medium",
                        variant === 'gradient' ? "text-white/70" : "text-muted-foreground/80"
                    )}>
                        {subtext}
                    </p>
                )}
            </div>
        </Card>
    );
};
