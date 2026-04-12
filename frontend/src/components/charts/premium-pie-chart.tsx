import React, { useState, useLayoutEffect, useRef } from 'react';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PremiumLoader } from '../ui/premium-loader';

interface ChartDataItem {
    name?: string;
    color?: string;
    [key: string]: string | number | undefined;
}

interface PremiumPieChartProps {
    title: string;
    description?: string;
    data: ChartDataItem[];
    dataKey: string;
    categoryKey: string;
    height?: number | string; // Phase 16: Institutional Flexibility (Relative Units supported)
    valuePrefix?: string;
    valueSuffix?: string;
    noCard?: boolean;
    titleClassName?: string;
    className?: string; // Standardized prop for layout injection
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ value?: number | string; name?: string }>;
    prefix?: string;
    suffix?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, prefix, suffix }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover border border-border shadow-xl rounded-[var(--card-radius)] p-3 animate-in fade-in-0 zoom-in-95">
                <p className="text-sm font-medium text-popover-foreground mb-1">{payload[0].name}</p>
                <p className="text-sm font-bold text-primary">
                    {prefix}{Number(payload[0].value)?.toLocaleString()}{suffix}
                </p>
            </div>
        );
    }
    return null;
};

export const PremiumPieChart: React.FC<PremiumPieChartProps> = ({
    title,
    description,
    data,
    dataKey,
    categoryKey,
    valuePrefix = '',
    valueSuffix = '',
    noCard = false,
    titleClassName = '',
    className
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLayoutReady, setIsLayoutReady] = useState(false);

    // Phase 17: Layout Synchronization Guard
    // Prevents Recharts from firing with width(-1) during the first-paint transition.
    useLayoutEffect(() => {
        if (!containerRef.current) return;
        
        const checkDimensions = () => {
            if (containerRef.current) {
                const { width, height: h } = containerRef.current.getBoundingClientRect();
                if (width > 0 && h > 0) {
                    setIsLayoutReady(true);
                }
            }
        };

        checkDimensions();
        
        // Handle window resizing or dynamic layout shifts
        const observer = new ResizeObserver(checkDimensions);
        observer.observe(containerRef.current);
        
        return () => observer.disconnect();
    }, []);

    const hasData = data && data.length > 0;

    const chartContent = (
        <div 
            ref={containerRef}
            className={cn(
                "flex items-center justify-center relative overflow-hidden",
                noCard ? "w-full h-full" : "w-full min-h-0", // Phase 18: Zero Pixel Policy (min-h-0)
                className
            )}
        >
            {!isLayoutReady || !hasData ? (
                <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground opacity-50 h-full w-full">
                    {!hasData ? (
                        <p className="text-sm font-medium italic">No clinical data available</p>
                    ) : (
                        <PremiumLoader size="md" />
                    )}
                </div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="42%" // Phase 19: Vertical Balance Lift (Institutional Grade)
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey={dataKey}
                            nameKey={categoryKey}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color || `hsl(var(--primary-${(index + 1) * 100}))`} strokeWidth={0} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip prefix={valuePrefix} suffix={valueSuffix} />} />
                        <Legend
                            verticalAlign="bottom"
                            iconType="circle"
                            formatter={(value) => (
                                <span className="text-[11px] font-bold text-muted-foreground/80 lowercase tracking-wide ml-1">
                                    {value}
                                </span>
                            )}
                        />
                    </PieChart>
                </ResponsiveContainer>
            )}
        </div>
    );

    if (noCard) {
        return chartContent;
    }

    return (
        <Card className="hover:shadow-md transition-shadow duration-300 overflow-hidden border-border/60 w-full h-full">
            <CardHeader className="pb-2">
                <CardTitle className={`text-lg font-bold tracking-tight ${titleClassName}`}>{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                {chartContent}
            </CardContent>
        </Card>
    );
};
