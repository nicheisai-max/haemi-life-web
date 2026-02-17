import React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface IconWrapperProps {
    icon: LucideIcon;
    className?: string;
    iconClassName?: string;
    variant?: 'primary' | 'neutral' | 'accent' | 'success' | 'warning' | 'destructive';
}

export const IconWrapper: React.FC<IconWrapperProps> = ({
    icon: Icon,
    className,
    iconClassName,
    variant = 'primary'
}) => {
    const variantStyles = {
        primary: "bg-primary/10 text-primary dark:bg-primary/20",
        neutral: "bg-muted text-muted-foreground",
        accent: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
        success: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
        warning: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
        destructive: "bg-destructive/10 text-destructive dark:bg-destructive/20",
    };

    return (
        <div className={cn(
            "flex items-center justify-center w-12 h-12 rounded-xl shrink-0 transition-colors",
            variantStyles[variant],
            className
        )}>
            <Icon
                className={cn("w-5 h-5", iconClassName)}
                strokeWidth={2}
            />
        </div>
    );
};
