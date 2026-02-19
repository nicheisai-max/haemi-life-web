import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from './button';
import type { LucideIcon } from 'lucide-react';
import { PlusCircle } from 'lucide-react';

interface AnimatedEmptyStateProps {
    title: string;
    description: string;
    icon: LucideIcon;
    actionLabel?: string;
    onAction?: () => void;
    suggestion?: string;
    variant?: 'full' | 'minimal';
}

export const AnimatedEmptyState: React.FC<AnimatedEmptyStateProps> = ({
    title,
    description,
    icon: Icon,
    actionLabel,
    onAction,
    suggestion,
    variant = 'full'
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                "flex flex-col items-center justify-center p-8 md:p-12 text-center",
                variant === 'full' && "rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50"
            )}
        >
            <div className="relative mb-6">
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0],
                    }}
                    transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="p-6 rounded-full bg-white dark:bg-slate-800 shadow-xl"
                >
                    <Icon className="h-12 w-12 text-primary/40" />
                </motion.div>
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary/20"
                />
            </div>

            <h3 className="text-xl font-bold tracking-tight text-foreground">{title}</h3>
            <p className="mt-2 text-muted-foreground max-w-xs mx-auto leading-relaxed">
                {description}
            </p>

            {suggestion && (
                <div className="mt-6 p-3 px-6 rounded-2xl bg-primary/5 border border-primary/10 text-xs font-medium text-primary inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                    AI Suggestion: {suggestion}
                </div>
            )}

            {actionLabel && onAction && (
                <Button
                    onClick={onAction}
                    className="mt-8 rounded-2xl h-12 px-8 gap-2 group shadow-lg shadow-primary/20"
                >
                    <PlusCircle className="h-5 w-5 group-hover:rotate-90 transition-transform" />
                    {actionLabel}
                </Button>
            )}
        </motion.div>
    );
};
