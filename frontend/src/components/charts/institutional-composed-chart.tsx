import React, { useState, useEffect, useMemo } from 'react';
import {
    ComposedChart,
    Area,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { logger } from '../../utils/logger';

interface InstitutionalComposedChartProps<T extends object> {
    title: string;
    description?: string;
    data: T[];
    areaKey: keyof T & string;
    lineKey: keyof T & string;
    categoryKey: keyof T & string;
    areaColor?: string;
    lineColor?: string;
    height?: number;
    valuePrefix?: string;
    valueSuffix?: string;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ value?: number | string; name?: string; color?: string }>;
    label?: string;
    prefix?: string;
    suffix?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, prefix, suffix }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover border border-border shadow-2xl rounded-[var(--card-radius)] p-4 animate-in fade-in-0 zoom-in-95 backdrop-blur-xl ring-1 ring-black/5">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] mb-2">{label}</p>
                <div className="space-y-2">
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 capitalize">{entry.name}</span>
                            </div>
                            <span className="text-xs font-black text-foreground">
                                {prefix}{Number(entry.value).toLocaleString()}{suffix}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

/**
 * Institutional Composed Chart (Google/Meta Grade)
 * 
 * - Generic Type Support
 * - Layered Area + Line visualization
 * - Dual SVG gradients for depth
 * - Institutional Legend and interactive Tooltips
 */
export const InstitutionalComposedChart = <T extends object>({
    title,
    description,
    data,
    areaKey,
    lineKey,
    categoryKey,
    areaColor = '#148C8B', // Primary-700
    lineColor = '#2563EB', // Info-500
    height = 350,
    valuePrefix = '',
    valueSuffix = ''
}: InstitutionalComposedChartProps<T>) => {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 300);
        return () => clearTimeout(timer);
    }, []);

    // Audit check for institutional data integrity
    useMemo(() => {
        if (!data || data.length === 0) {
            logger.warn(`[Charts] InstitutionalComposedChart('${title}') received null/empty data set.`);
        }
    }, [data, title]);

    return (
        <Card className="hover:shadow-2xl transition-all duration-700 overflow-hidden border-border/60 hover:border-primary/40 group bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50 uppercase tracking-widest">{title}</CardTitle>
                {description && <CardDescription className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                <div style={{ width: '100%', height: height, position: 'relative' }}>
                    {isMounted ? (
                        <ResponsiveContainer width="100%" height="100%" debounce={50}>
                            <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                                <defs>
                                    <linearGradient id={`composedAreaGradient-${String(areaKey)}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor={areaColor} stopOpacity={0.2} />
                                        <stop offset="95%" stopColor={areaColor} stopOpacity={0} />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid 
                                    vertical={false} 
                                    strokeDasharray="3 3" 
                                    strokeOpacity={0.05} 
                                    className="stroke-slate-950 dark:stroke-slate-50"
                                />

                                <XAxis
                                    dataKey={categoryKey as string}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'currentColor', fontSize: 10, fontWeight: 700 }}
                                    tickMargin={12}
                                    className="text-slate-400 dark:text-slate-500"
                                />

                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'currentColor', fontSize: 10, fontWeight: 700 }}
                                    tickFormatter={(value) => `${valuePrefix}${value.toLocaleString()}${valueSuffix}`}
                                    className="text-slate-400 dark:text-slate-500"
                                />

                                <Tooltip
                                    content={<CustomTooltip prefix={valuePrefix} suffix={valueSuffix} />}
                                    cursor={{ stroke: '#94A3B8', strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.3 }}
                                />

                                <Legend 
                                    verticalAlign="top" 
                                    align="right" 
                                    height={36}
                                    iconType="circle"
                                    formatter={(value: string) => <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{value}</span>}
                                />

                                <Area
                                    type="monotone"
                                    name="Revenue"
                                    dataKey={areaKey as string}
                                    stroke={areaColor}
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill={`url(#composedAreaGradient-${String(areaKey)})`}
                                    animationDuration={2000}
                                />

                                <Line
                                    type="monotone"
                                    name="Expenses"
                                    dataKey={lineKey as string}
                                    stroke={lineColor}
                                    strokeWidth={3}
                                    dot={{ r: 0 }}
                                    activeDot={{ r: 4, strokeWidth: 0, fill: lineColor }}
                                    animationDuration={2500}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/10 animate-pulse rounded-[var(--card-radius)]">
                            <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Initializing Intelligence...</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
