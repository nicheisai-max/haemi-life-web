import React, { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { logger } from '../../utils/logger';

interface PremiumBarChartProps<T extends object> {
    title: string;
    description?: string;
    data: T[];
    dataKey: keyof T & string;
    categoryKey: keyof T & string;
    color?: string;
    height?: number;
    valuePrefix?: string;
    valueSuffix?: string;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ value?: number | string }>;
    label?: string;
    prefix?: string;
    suffix?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, prefix, suffix }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover border border-border shadow-xl rounded-[var(--card-radius)] p-3 animate-in fade-in-0 zoom-in-95 backdrop-blur-md">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                <p className="text-sm font-black text-primary">
                    {prefix}{Number(payload[0].value).toLocaleString()}{suffix}
                </p>
            </div>
        );
    }
    return null;
};

/**
 * Institutional Bar Chart (Google/Meta Grade)
 * 
 * - Generic Type Support
 * - SVG Linear Gradients for depth
 * - Rounded top corners (8px)
 * - Theme-aware styling (Light/Dark)
 */
export const PremiumBarChart = <T extends object>({
    title,
    description,
    data,
    dataKey,
    categoryKey,
    color = '#148C8B', // Primary-700
    height = 350,
    valuePrefix = '',
    valueSuffix = ''
}: PremiumBarChartProps<T>) => {
    // Audit check for institutional data integrity
    useMemo(() => {
        if (!data || data.length === 0) {
            logger.warn(`[Charts] PremiumBarChart('${title}') received null/empty data set.`);
        }
    }, [data, title]);

    return (
        <Card className="hover:shadow-lg transition-all duration-500 overflow-hidden border-border/60 hover:border-primary/30 group">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">{title}</CardTitle>
                {description && <CardDescription className="text-xs text-slate-500 font-medium">{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                <div style={{ width: '100%', height: height, minHeight: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data}
                            margin={{ top: 20, right: 30, left: -20, bottom: 0 }}
                            barGap={8}
                        >
                            <defs>
                                <linearGradient id={`barGradient-${String(dataKey)}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%"   stopColor={color} stopOpacity={1} />
                                    <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                                </linearGradient>
                            </defs>
                            
                            <CartesianGrid 
                                vertical={false} 
                                strokeDasharray="3 3" 
                                strokeOpacity={0.1} 
                                className="stroke-slate-300 dark:stroke-slate-700"
                            />
                            
                            <XAxis
                                dataKey={categoryKey as string}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'currentColor', fontSize: 11, fontWeight: 500 }}
                                tickMargin={12}
                                className="text-slate-400 dark:text-slate-500"
                            />
                            
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'currentColor', fontSize: 11, fontWeight: 500 }}
                                tickFormatter={(value) => `${valuePrefix}${value.toLocaleString()}${valueSuffix}`}
                                className="text-slate-400 dark:text-slate-500"
                            />
                            
                            <Tooltip
                                content={<CustomTooltip prefix={valuePrefix} suffix={valueSuffix} />}
                                cursor={{ fill: 'currentColor', opacity: 0.05 }}
                            />
                            
                            <Bar
                                dataKey={dataKey as string}
                                radius={[8, 8, 0, 0]}
                                barSize={32}
                                animationDuration={1800}
                                animationEasing="ease-in-out"
                            >
                                {data.map((_, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={`url(#barGradient-${String(dataKey)})`}
                                        className="transition-all duration-300 hover:opacity-80"
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};
