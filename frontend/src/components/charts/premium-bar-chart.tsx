import React, { memo, useEffect, useMemo, useState } from 'react';
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

/**
 * 🩺 HAEMI LIFE — PremiumBarChart (Google/Meta Grade)
 *
 * Phase 5 follow-up performance fixes:
 *
 *   1. **Mount gate (300 ms)** — `<ResponsiveContainer>` measures its
 *      parent on its first paint. When the parent is wrapped in a
 *      `<TransitionItem>` that fades/slides in, the parent's resolved
 *      width can momentarily be 0 px, triggering Recharts' visible
 *      `width(-1) and height(-1) of chart should be greater than 0`
 *      console warning. The 300 ms `isMounted` gate (mirroring
 *      `InstitutionalComposedChart`) lets the parent layout settle
 *      before Recharts measures it. Suppresses the warning at the
 *      source, no monkey-patching of Recharts.
 *
 *   2. **`React.memo` boundary** — the chart is a heavy SVG subtree.
 *      Without `memo`, every parent state update (e.g. live KPI
 *      counter changes on the admin dashboard) re-runs the entire
 *      chart render even when the chart's own props are unchanged —
 *      which on the dashboard manifests as `[Violation] 'message'
 *      handler took 200ms+` from React's scheduler. The custom
 *      equality function below compares the props that actually
 *      affect render (data, keys, colour, dimensions, value
 *      affixes); identity equality on `data` is sufficient because
 *      callers pass the same array reference unless the data
 *      genuinely changes.
 *
 *   3. **Animation duration tightened** — was 1800 ms, now 400 ms.
 *      Industry standard for transitions; long animations were the
 *      direct cause of `requestAnimationFrame` budget violations
 *      visible in DevTools. The chart still feels alive, but each
 *      animated frame's main-thread work is bounded.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - The single `as typeof InnerPremiumBarChart` cast on the memoised
 *     export is required to preserve the generic signature across
 *     `React.memo`'s `MemoExoticComponent` widening — a known
 *     TypeScript limitation for generic components. Single-cast,
 *     structurally narrowing to a known-correct type, NOT a
 *     double-cast.
 *   - All errors via `logger`. No `console.*`.
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
     * is just a string lookup.
     */
    dataKey: string;
    /** Property name on T containing the category-axis label. */
    categoryKey: string;
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

const InnerPremiumBarChart = <T extends object>({
    title,
    description,
    data,
    dataKey,
    categoryKey,
    color = '#148C8B', // Primary-700
    height = 350,
    valuePrefix = '',
    valueSuffix = ''
}: PremiumBarChartProps<T>): React.ReactElement => {
    const [isMounted, setIsMounted] = useState<boolean>(false);

    useEffect(() => {
        // 300 ms gate: lets the parent <TransitionItem>'s opacity/transform
        // entrance animation settle before Recharts measures the container.
        // Without this gate, the first measurement returns -1 width on
        // pages where the chart's parent fades in.
        const timer = setTimeout(() => setIsMounted(true), 300);
        return () => clearTimeout(timer);
    }, []);

    // Audit check for institutional data integrity. The `useMemo` here is
    // the existing project pattern; it acts as a render-time invariant
    // check rather than a real memoisation, but logging through `logger`
    // keeps the strict-TS posture intact. Not in scope to refactor here.
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
                    {isMounted ? (
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

/**
 * Custom prop-equality function for `React.memo`. Returns `true` when
 * the upstream props are equivalent enough that re-rendering would
 * produce the same SVG output — letting React skip the chart's heavy
 * reconciliation entirely.
 *
 * Identity equality on `data` is the right check: callers either pass
 * the same constant reference (the dashboard's static growth data
 * literal) or a new array reference when the data genuinely changes.
 * Deep-equal comparison on a possibly-large data array would defeat
 * the whole point of memoisation.
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
    && prev.height === next.height
    && prev.valuePrefix === next.valuePrefix
    && prev.valueSuffix === next.valueSuffix;

/**
 * Memoised export. The single `as typeof InnerPremiumBarChart` cast is
 * the canonical TypeScript pattern for preserving a generic component
 * signature through `React.memo` (which would otherwise widen to
 * `MemoExoticComponent<unknown>`). Single-cast, structurally narrowing
 * to a type that is known-correct because the inner function and the
 * wrapper share identical parameter types — NOT `as unknown as`.
 */
export const PremiumBarChart = memo(InnerPremiumBarChart, arePropsEqual) as typeof InnerPremiumBarChart;
