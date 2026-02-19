import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PremiumLoaderProps {
    size?: 'xs' | 'sm' | 'md' | 'lg';
    className?: string;
    bubbleClassName?: string;
}

export const PremiumLoader: React.FC<PremiumLoaderProps> = ({
    size = 'md',
    className,
    bubbleClassName
}) => {
    const sizeMap = {
        xs: { container: 'h-4 w-12', bubble: 'h-1.5 w-1.5', gap: 'gap-0.5' },
        sm: { container: 'h-6 w-16', bubble: 'h-2 w-2', gap: 'gap-1' },
        md: { container: 'h-10 w-24', bubble: 'h-3 w-3', gap: 'gap-1.5' },
        lg: { container: 'h-16 w-32', bubble: 'h-4 w-4', gap: 'gap-2' },
    };

    const currentSize = sizeMap[size];

    const bubbleVariants = {
        animate: (i: number) => ({
            scale: [1, 1.4, 1],
            opacity: [0.3, 1, 0.3],
            transition: {
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut" as const,
            },
        }),
    };

    return (
        <div className={cn(
            "flex items-center justify-center",
            currentSize.container,
            currentSize.gap,
            className
        )}>
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    custom={i}
                    variants={bubbleVariants}
                    animate="animate"
                    className={cn(
                        "rounded-full shadow-[0_0_10px_rgba(var(--primary),0.2)]",
                        bubbleClassName ? bubbleClassName : "bg-primary",
                        currentSize.bubble
                    )}
                />
            ))}
        </div>
    );
};
