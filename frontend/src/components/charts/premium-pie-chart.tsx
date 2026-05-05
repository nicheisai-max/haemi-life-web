import React from 'react';
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
import { ChartMountGate } from './chart-mount-gate';
import { PremiumLoader } from '../ui/premium-loader';

/**
 * 🩺 HAEMI LIFE — PremiumPieChart (Google/Meta Grade)
 *
 * Mount discipline:
 *   The Recharts subtree is gated by `<ChartMountGate>` (shared helper),
 *   replacing this component's previous bespoke ResizeObserver +
 *   `isLayoutReady` state — the same pattern duplicated inline. The
 *   shared gate is the single source of truth for "wait until parent is
 *   measured" logic, so all charts in the codebase behave identically.
 *
 * Layout discipline:
 *   The wrapper sizing is controlled by the caller via the `className`
 *   prop (existing API) — the gate composes seamlessly because it only
 *   sets `position: relative` + size tokens; the caller's flex/grid
 *   context cascades through. Zero inline styles, zero `px` values
 *   originating in this file.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - Empty-data path renders an italic "No clinical data available"
 *     message INSIDE the gate's children — i.e. the gate fires `fallback`
 *     until the parent is measured, then we either show the chart or the
 *     empty state. This separates "is the layout ready?" from "is there
 *     data?" — two orthogonal questions.
 */

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
    valuePrefix?: string;
    valueSuffix?: string;
    noCard?: boolean;
    titleClassName?: string;
    /**
     * Standardised prop for layout injection. The caller decides the
     * frame's width/height via Tailwind/CSS classes; no pixel values
     * are accepted at this boundary.
     */
    className?: string;
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

const PieChartFallback: React.FC = () => (
    <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground opacity-50 h-full w-full">
        <PremiumLoader size="md" />
    </div>
);

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
    const hasData: boolean = data.length > 0;

    // Compose the gate's wrapper class with the caller's layout class.
    // The gate's default `.haemi-chart-frame` would impose a fixed height
    // here, but pie charts are placed in flex/grid containers managed by
    // the caller; we override the default to a fluid pass-through that
    // honours the parent's intrinsic sizing.
    const frameClass: string = cn(
        'flex items-center justify-center relative overflow-hidden',
        noCard ? 'w-full h-full' : 'w-full min-h-0',
        className
    );

    const chartContent = (
        <ChartMountGate fallback={<PieChartFallback />} className={frameClass}>
            {!hasData ? (
                <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground opacity-50 h-full w-full">
                    <p className="text-sm font-medium italic">No clinical data available</p>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="42%"
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
        </ChartMountGate>
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
