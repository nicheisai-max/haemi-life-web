import React from 'react';
import { 
    Radar, RadarChart, PolarGrid, 
    PolarAngleAxis, ResponsiveContainer 
} from 'recharts';
import { Activity, Minus } from 'lucide-react';
import { logger } from '../../utils/logger';

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
    readonly height?: number;
}

/**
 * InstitutionalRadarChart Component
 * State-of-the-art efficiency diagnostic visualization.
 * Features:
 * - Dynamic theme-aware color mapping (Teal/Slate) via CSS variables
 * - Calibration Overlay with pulsing animations
 * - Institutional branding and metadata
 * 
 * Standards: Google/Meta-grade TypeScript, No JSX in try-catch, Institutional Logging.
 */
export const InstitutionalRadarChart: React.FC<InstitutionalRadarChartProps> = ({
    data,
    title = "Operational Efficiency Matrix",
    subtitle = "Multi-axial performance throughput diagnostics",
    isCalibrating = false,
    height = 300
}): React.ReactElement => {
    // 🛡️ Institutional Audit: Diagnostic state tracking
    if (isCalibrating) {
        logger.info('[InstitutionalRadarChart] Initializing in Calibration Mode');
    }

    // 🛡️ Data Integrity Check
    if (!data || data.length === 0) {
        logger.warn('[InstitutionalRadarChart] Empty dataset provided to diagnostic module.');
        return (
            <div className="flex flex-col items-center justify-center p-8 min-h-[250px] space-y-4 bg-slate-50 dark:bg-slate-900/10 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <Minus className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                    Diagnostic Flux: No Input Detected
                </p>
            </div>
        );
    }

    const themeColor = 'var(--primary)'; 

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
                <div className="relative w-full" style={{ height: `${height}px` }}>
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
                </div>

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
