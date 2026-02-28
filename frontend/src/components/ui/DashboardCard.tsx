import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface DashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    noPadding?: boolean;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
    children,
    className,
    noPadding = false,
    ...props
}) => {
    return (
        <Card
            className={cn(
                "rounded-card border-border/50 dark:border-border/10 shadow-sm dark:shadow-none transition-all duration-200 hover:shadow-md bg-card text-card-foreground h-full flex flex-col",
                !noPadding && "p-6",
                className
            )}
            {...props}
        >
            {children}
        </Card>
    );
};
