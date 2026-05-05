import React, { memo, useMemo } from 'react';
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
import { ChartMountGate } from './chart-mount-gate';
import { logger } from '../../utils/logger';

/**
 * 🩺 HAEMI LIFE — PremiumBarChart (Google/Meta Grade)
 *
 * Mount discipline:
 *   The chart's Recharts subtree is gated by `<ChartMountGate>`, which
 *   uses `ResizeObserver` to defer the subtree until its wrapper has
 *   measured non-zero dimensions. This eliminates the
 *   `width(-1)/height(-1)` warning at the source — the previous 300 ms
 *   timer was a fragile band-aid that broke whenever the parent was
 *   wrapped in a Framer Motion spring entrance (which can exceed
 *   300 ms in practice).
 *
 * Layout discipline:
 *   The wrapper's `width: 100%; height: 21.875rem; min-height: 18.75rem`
 *   contract lives in `.haemi-chart-frame` (index.css) — single CSS
 *   class, rem-based, no inline styles, no `px` values. Recharts'
 *   `<ResponsiveContainer>` measures this stable parent without
 *   ambiguity.
 *
 * Re-render discipline:
 *   The component is wrapped in `React.memo` with a hand-written
 *   `arePropsEqual` so live KPI counter updates on the parent
 *   (admin dashboard) do NOT propagate into the heavy SVG subtree —
 *   the memoised export skips reconciliation when its own props are
 *   unchanged.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - The single `as typeof InnerPremiumBarChart` cast on the memoised
 *     export preserves the generic signature across `React.memo`'s
 *     `MemoExoticComponent<unknown>` widening — a known TypeScript
 *     limitation, single-cast NOT double-cast, documented inline.
 *   - All errors via `logger`. Zero `console.*`.
 */

interface PremiumBarChartProps<T extends object> {
    title: string;
    description?: string;
    data: T[];
    /**
     * Property name on T containing the numeric series value.
     * Typed as `string` (not `keyof T & string`) because recharts'
     * `DataKey<T>` accepts a wider surface than TypeScript's `keyof T`
     * intersection produces at the prop boundary; the runtime accessor
     * is a string lookup.
     */
    dataKey: string;
    /** Property name on T containing the category-axis label. */
    categoryKey: string;
    color?: string;
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

const ChartSkeleton: React.FC = () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/10 animate-pulse rounded-[var(--card-radius)]">
        <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Initializing Intelligence...</span>
    </div>
);

const InnerPremiumBarChart = <T extends object>({
    title,
    description,
    data,
    dataKey,
    categoryKey,
    color = '#148C8B', // Primary-700
    valuePrefix = '',
    valueSuffix = ''
}: PremiumBarChartProps<T>): React.ReactElement => {
    // Audit check for institutional data integrity. The `useMemo` here
    // acts as a render-time invariant check rather than memoisation,
    // logging through `logger` to keep strict-TS posture intact.
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
                <ChartMountGate fallback={<ChartSkeleton />}>
                    <ResponsiveContainer width="100%" height="100%" debounce={50}>
                        <BarChart
                            data={data}
                            margin={{ top: 20, right: 30, left: -20, bottom: 0 }}
                            barGap={8}
                        >
                            <defs>
                                <linearGradient id={`barGradient-${String(dataKey)}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={color} stopOpacity={1} />
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
                                dataKey={categoryKey}
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
                                dataKey={dataKey}
                                radius={[8, 8, 0, 0]}
                                barSize={32}
                                animationDuration={400}
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
                </ChartMountGate>
            </CardContent>
        </Card>
    );
};

/**
 * Custom prop-equality function for `React.memo`. Identity equality on
 * `data` is the right check: callers either pass the same constant
 * reference (e.g. the dashboard's static literal) or a fresh array
 * reference when data genuinely changes. Deep comparison would defeat
 * memoisation and add no value when the upstream is stable.
 */
const arePropsEqual = <T extends object>(
    prev: PremiumBarChartProps<T>,
    next: PremiumBarChartProps<T>
): boolean =>
    prev.data === next.data
    && prev.dataKey === next.dataKey
    && prev.categoryKey === next.categoryKey
    && prev.title === next.title
    && prev.description === next.description
    && prev.color === next.color
    && prev.valuePrefix === next.valuePrefix
    && prev.valueSuffix === next.valueSuffix;

/**
 * Memoised export. The `as typeof InnerPremiumBarChart` cast preserves
 * the generic signature across `React.memo`'s `MemoExoticComponent`
 * widening — canonical pattern for generic memoised components.
 * Single cast, structurally narrowing to a known-correct type.
 */
export const PremiumBarChart = memo(InnerPremiumBarChart, arePropsEqual) as typeof InnerPremiumBarChart;
