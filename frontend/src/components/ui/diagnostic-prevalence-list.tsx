import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { logger } from '../../utils/logger';

export interface DiagnosisEntry {
    readonly name: string;
    readonly count: number;
    readonly percentage: number;
    readonly trend?: 'up' | 'down' | 'stable';
    readonly trendValue?: string;
}

interface DiagnosticPrevalenceListProps {
    readonly data: readonly DiagnosisEntry[];
    readonly title?: string;
    readonly subtitle?: string;
}

/**
 * DiagnosticPrevalenceList Component
 * Institutional-grade horizontal distribution chart for pathology analytics.
 * Features:
 * - Brand-aligned gradients (Primary-700)
 * - Animated bar growth (Framer Motion)
 * - Semantic trend indicators
 * - Theme-aware contrast (Light/Dark)
 * 
 * Standards: Google/Meta-grade TypeScript, No JSX in try-catch, Institutional Logging.
 */
export const DiagnosticPrevalenceList: React.FC<DiagnosticPrevalenceListProps> = ({ 
    data, 
    title = "Clinical Taxonomy Analysis",
    subtitle = "Analysis of the most frequent clinical encounters"
}): React.ReactElement => {
    // 🛡️ Institutional Audit: Data-passing integrity check (before render)
    // We log inconsistencies here to maintain a forensic audit trail without 
    // violating React's JSX-construction linting rules.
    if (!data || data.length === 0) {
        logger.info('[DiagnosticPrevalenceList] Render initiated with empty/null data set.');
        return (
            <div className="p-6 flex flex-col items-center justify-center text-center space-y-2 bg-slate-50 dark:bg-slate-900/10 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <Minus className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    No Diagnostic Data Calibrated
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                    {title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {subtitle}
                </p>
            </div>

            <div className="space-y-5">
                {data.map((item, i) => (
                    <motion.div 
                        key={item.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="group"
                    >
                        <div className="flex justify-between items-end mb-1.5">
                            <div className="space-y-0.5">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-primary transition-colors">
                                    {item.name}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase">
                                        {item.count} CASES
                                    </span>
                                    {item.trend && (
                                        <div className={`flex items-center gap-0.5 text-[9px] font-bold ${
                                            item.trend === 'up' ? 'text-emerald-500' : 
                                            item.trend === 'down' ? 'text-rose-500' : 'text-slate-400'
                                        }`}>
                                            {item.trend === 'up' ? <TrendingUp className="h-2.5 w-2.5" /> : 
                                             item.trend === 'down' ? <TrendingDown className="h-2.5 w-2.5" /> : 
                                             <Minus className="h-2.5 w-2.5" />}
                                            {item.trendValue || 'Stable'}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <span className="text-sm font-black text-primary/80">
                                {item.percentage}%
                            </span>
                        </div>

                        <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${item.percentage}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="h-full rounded-full bg-gradient-to-r from-teal-600 to-teal-400 dark:from-teal-500 dark:to-teal-300 shadow-[0_0_10px_rgba(20,140,139,0.2)]"
                            />
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                    * Aggregated data from institutional consultation logs (Last 30 Days).
                </p>
            </div>
        </div>
    );
};
