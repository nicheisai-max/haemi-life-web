import React from 'react';
import {
    Radar, RadarChart, PolarGrid,
    PolarAngleAxis, ResponsiveContainer
} from 'recharts';
import { Activity, Minus } from 'lucide-react';
import { ChartMountGate } from './chart-mount-gate';
import { logger } from '../../utils/logger';
import type { ChartSize } from './premium-area-chart';

/**
 * 🩺 HAEMI LIFE — InstitutionalRadarChart (Google/Meta Grade)
 *
 * Mount discipline:
 *   The Recharts subtree is gated by `<ChartMountGate>`. Replaces the
 *   previous `style={{ height: \`${height}px\` }}` inline-pixel wrapper
 *   that violated the project's "no px in JSX" mandate AND fired the
 *   Recharts `width(-1)/height(-1)` warning when measured before the
 *   parent settled.
 *
 * Layout discipline:
 *   The wrapper is now a `.haemi-chart-frame--{sm|md|lg}` rem-based
 *   class — three sizes mirror the previous `height` prop's range
 *   (250/300/350 → sm/md/lg). The single existing caller does not pass
 *   a height, so the default `'md'` (18.75rem ≈ 300px) preserves the
 *   prior visual.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - `size` prop is a literal-type union, not a number. Pixel values
 *     are inadmissible at the call boundary.
 *   - Empty-data path renders the existing diagnostic-flux placeholder
 *     and returns early — gate is not engaged in that case (nothing to
 *     measure).
 */

export interface RadarDataPoint {
    readonly subject: string;
    readonly value: number;
    readonly fullMark: number;
}

interface InstitutionalRadarChartProps {
    readonly data: readonly RadarDataPoint[];
    readonly title?: string;
    readonly subtitle?: string;
    readonly isCalibrating?: boolean;
    /**
     * Frame height. Maps to `.haemi-chart-frame--{size}` (rem-based).
     * Defaults to `'md'` (18.75rem) for visual parity with the previous
     * `height = 300` default.
     */
    readonly size?: ChartSize;
}

const FRAME_CLASS_BY_SIZE: Readonly<Record<ChartSize, string>> = {
    sm: 'haemi-chart-frame--sm',
    md: 'haemi-chart-frame--md',
    lg: 'haemi-chart-frame--lg',
};

const RadarSkeleton: React.FC = () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/10 animate-pulse rounded-[var(--card-radius)]">
        <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Calibrating Diagnostic Matrix...</span>
    </div>
);

export const InstitutionalRadarChart: React.FC<InstitutionalRadarChartProps> = ({
    data,
    title = "Operational Efficiency Matrix",
    subtitle = "Multi-axial performance throughput diagnostics",
    isCalibrating = false,
    size = 'md'
}): React.ReactElement => {
    if (isCalibrating) {
        logger.info('[InstitutionalRadarChart] Initializing in Calibration Mode');
    }

    if (!data || data.length === 0) {
        logger.warn('[InstitutionalRadarChart] Empty dataset provided to diagnostic module.');
        return (
            <div className="flex flex-col items-center justify-center p-8 min-h-[15.625rem] space-y-4 bg-slate-50 dark:bg-slate-900/10 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <Minus className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                    Diagnostic Flux: No Input Detected
                </p>
            </div>
        );
    }

    const themeColor = 'var(--primary)';
    const frameClass: string = FRAME_CLASS_BY_SIZE[size];

    return (
        <div className="relative flex flex-col justify-between h-full space-y-4">
            <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                        {title}
                    </h3>
                    {isCalibrating && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-sm animate-pulse">
                            <Activity className="h-3 w-3 text-emerald-500" />
                            <span className="text-[9px] font-black tracking-tighter text-emerald-600 uppercase">Calibrating</span>
                        </div>
                    )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {subtitle}
                </p>
            </div>

            {/* 📊 Balanced Visualization Area: Distributed spacing for premium feel */}
            <div className="flex-grow flex flex-col items-center justify-center py-6">
                <ChartMountGate fallback={<RadarSkeleton />} className={frameClass}>
                    {isCalibrating && (
                        <div className="absolute inset-x-0 inset-y-0 z-10 flex flex-col items-center justify-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-[2px] rounded-[var(--card-radius)]">
                            <div className="relative mb-4">
                                <Activity className="h-10 w-10 text-primary opacity-20" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                </div>
                                <div className="absolute -inset-2 bg-primary/10 rounded-full animate-ping opacity-20" />
                            </div>
                            <div className="text-center px-6">
                                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 tracking-widest mb-1">
                                    Calibration Active
                                </p>
                                <p className="text-[9px] text-slate-500 dark:text-slate-400 italic max-w-[180px]">
                                    Institutional engine is learning your documentation cadence. ETA: 48h.
                                </p>
                            </div>
                        </div>
                    )}

                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                            <PolarGrid
                                stroke="var(--border)"
                                className="dark:opacity-30 opacity-60"
                            />
                            <PolarAngleAxis
                                dataKey="subject"
                                tick={{
                                    fill: 'var(--foreground)',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    fontFamily: 'Roboto',
                                    opacity: 0.7
                                }}
                            />
                            <Radar
                                name="Efficiency"
                                dataKey="value"
                                stroke={themeColor}
                                fill={themeColor}
                                fillOpacity={0.4}
                                strokeWidth={2}
                                animationDuration={1500}
                                animationEasing="ease-in-out"
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                </ChartMountGate>

                {/* 🏷️ Centered Legend: Institutional horizontal axis alignment */}
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mt-4">
                    {data.map((point) => (
                        <div key={point.subject} className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-tight">
                                {point.subject}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 📝 Pixel-Perfect Footer Disclaimer: Synced horizontally with left widget */}
            <div className="pt-4 border-t border-slate-100 dark:border-none">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                    * Aggregated data from institutional consultation logs (Last 30 Days).
                </p>
            </div>
        </div>
    );
};
