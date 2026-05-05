import React from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartMountGate } from './chart-mount-gate';

/**
 * 🩺 HAEMI LIFE — PremiumAreaChart (Google/Meta Grade)
 *
 * Mount discipline:
 *   The Recharts subtree is gated by `<ChartMountGate>`, which uses
 *   `ResizeObserver` to defer the subtree until its wrapper has measured
 *   non-zero dimensions. Replaces a `setTimeout(setIsMounted, 300)`
 *   band-aid that broke whenever the chart's parent was wrapped in a
 *   Framer Motion spring entrance (which can exceed 300 ms in practice).
 *
 * Layout discipline:
 *   The wrapper sizing is delegated to `.haemi-chart-frame--{sm|md|lg}`
 *   classes (defined in `index.css`) — every dimension is rem-based,
 *   no inline styles, no `px` values. Three sizes mirror the previous
 *   `height` prop's three call-site values (250/300/350) so the visual
 *   hierarchy is preserved without leaking pixels into JSX.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - `size` prop is a literal-type union, not a number — pixel values
 *     are inadmissible at the call boundary.
 */

export interface ChartDataItem {
    [key: string]: string | number | undefined;
}

export type ChartSize = 'sm' | 'md' | 'lg';

interface PremiumAreaChartProps {
    title: string;
    description?: string;
    data: ChartDataItem[];
    dataKey: string;
    categoryKey: string;
    color?: string;
    /**
     * Frame height. Maps to `.haemi-chart-frame--{size}` (rem-based).
     * Defaults to `'lg'` (21.875rem) for visual parity with the project's
     * default chart frame.
     */
    size?: ChartSize;
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

const CustomTooltip = ({ active, payload, label, prefix, suffix }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover border border-border shadow-xl rounded-[var(--card-radius)] p-3 animate-in fade-in-0 zoom-in-95">
                <p className="text-sm font-medium text-popover-foreground mb-1">{label}</p>
                <p className="text-sm font-bold text-primary">
                    {prefix}{payload[0].value?.toLocaleString()}{suffix}
                </p>
            </div>
        );
    }
    return null;
};

const ChartSkeleton: React.FC = () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/10 animate-pulse rounded-[var(--card-radius)]">
        <span className="text-xs text-slate-400 font-medium tracking-widest uppercase">Calculating Metrics...</span>
    </div>
);

/**
 * Computes the X-axis tick interval to prevent label collision.
 *
 * Strategy: Show at most `maxTicks` labels across all data points.
 * For <= 10 items: show every label. For > 10: thin to ~7 visible ticks.
 * This ensures readability from mobile (4 items visible) to large desktop.
 */
const computeTickInterval = (dataLength: number, maxTicks: number = 7): number => {
    if (dataLength <= maxTicks) return 0; // Show all
    return Math.ceil(dataLength / maxTicks) - 1;
};

const FRAME_CLASS_BY_SIZE: Readonly<Record<ChartSize, string>> = {
    sm: 'haemi-chart-frame--sm',
    md: 'haemi-chart-frame--md',
    lg: 'haemi-chart-frame--lg',
};

export const PremiumAreaChart: React.FC<PremiumAreaChartProps> = ({
    title,
    description,
    data,
    dataKey,
    categoryKey,
    color = '#0E6B74', // Primary-800 from brand
    size = 'lg',
    valuePrefix = '',
    valueSuffix = ''
}) => {
    const tickInterval = computeTickInterval(data.length);
    const frameClass: string = FRAME_CLASS_BY_SIZE[size];

    return (
        <Card className="hover:shadow-md transition-shadow duration-300 overflow-hidden border-border/60">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold tracking-tight">{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent className="px-2 pb-4 sm:px-6">
                <ChartMountGate fallback={<ChartSkeleton />} className={frameClass}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                        <AreaChart
                            data={data}
                            margin={{
                                top: 10,
                                right: 16,
                                // Left margin accommodates the YAxis label width on all viewports.
                                // Without this, Y-axis tick text clips on narrow screens.
                                left: -10,
                                // Bottom margin is critical: without it, XAxis tick text is
                                // rendered outside the SVG viewport and becomes invisible.
                                bottom: 10,
                            }}
                        >
                            <defs>
                                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            </defs>

                            <CartesianGrid
                                vertical={false}
                                strokeDasharray="3 3"
                                strokeOpacity={0.1}
                            />

                            <XAxis
                                dataKey={categoryKey}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748B', fontSize: 11 }}
                                tickMargin={10}
                                // Computed interval prevents collision on dense datasets (e.g. 31-day trends).
                                // Shows ~7 evenly distributed labels regardless of data length.
                                interval={tickInterval}
                            />

                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748B', fontSize: 11 }}
                                // Explicit width reservation prevents Y-axis labels from being
                                // clipped on narrow viewports (mobile / tablet breakpoints).
                                width={45}
                                tickFormatter={(value: number) => `${valuePrefix}${value.toLocaleString()}${valueSuffix}`}
                            />

                            <Tooltip
                                content={<CustomTooltip prefix={valuePrefix} suffix={valueSuffix} />}
                                cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4' }}
                            />

                            <Area
                                type="monotone"
                                dataKey={dataKey}
                                stroke={color}
                                strokeWidth={2.5}
                                fillOpacity={1}
                                fill="url(#colorGradient)"
                                animationDuration={1500}
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0, fill: color }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartMountGate>
            </CardContent>
        </Card>
    );
};
