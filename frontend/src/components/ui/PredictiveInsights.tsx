import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';

interface Insight {
    label: string;
    value: string;
    description: string;
    trend: 'up' | 'down' | 'neutral';
    trendValue: string;
    icon: React.ElementType;
    variant: 'primary' | 'secondary' | 'accent';
}

interface PredictiveInsightsProps {
    insights: Insight[];
    title?: string;
}

export const PredictiveInsights: React.FC<PredictiveInsightsProps> = ({ insights, title = "Predictive Intelligence" }) => {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h2>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 shadow-sm">
                    <Zap className="h-3.5 w-3.5 text-primary animate-pulse" />
                    <span className="text-[10px] uppercase font-black tracking-widest text-primary">Live Projections</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {insights.map((insight, index) => (
                    <motion.div
                        key={insight.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="h-full"
                    >
                        <div className="relative group h-full overflow-hidden rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-primary/30 dark:hover:border-primary/30 transition-all duration-300">
                            {/* Subtle Gradient Overlay */}
                            <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500 bg-gradient-to-br ${insight.variant === 'primary' ? 'from-emerald-500 to-teal-500' :
                                insight.variant === 'secondary' ? 'from-blue-500 to-indigo-500' :
                                    'from-amber-500 to-orange-500'
                                }`} />

                            <div className="relative p-6 flex flex-col justify-between h-full space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className={`p-3 rounded-xl shadow-sm transition-transform group-hover:scale-110 ${insight.variant === 'primary' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' :
                                        insight.variant === 'secondary' ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' :
                                            'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                                        }`}>
                                        <insight.icon className="h-6 w-6" />
                                    </div>
                                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${insight.trend === 'up' ? 'text-emerald-700 bg-emerald-50 border-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20' :
                                        insight.trend === 'down' ? 'text-rose-700 bg-rose-50 border-rose-100 dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-500/20' :
                                            'text-slate-600 bg-slate-50 border-slate-100 dark:text-slate-400 dark:bg-slate-500/10 dark:border-slate-500/20'
                                        }`}>
                                        {insight.trend === 'up' && <ArrowUpRight className="h-3 w-3" strokeWidth={3} />}
                                        {insight.trend === 'down' && <ArrowDownRight className="h-3 w-3" strokeWidth={3} />}
                                        {insight.trendValue}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">{insight.label}</h3>
                                    <div className="text-h1 text-slate-900 dark:text-white">
                                        {insight.value}
                                    </div>
                                </div>

                                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                                    {insight.description}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
