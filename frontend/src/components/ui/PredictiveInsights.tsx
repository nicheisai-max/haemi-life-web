import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';
import { GlassCard } from './GlassCard';

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
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
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
                    >
                        <GlassCard className="p-6 h-full flex flex-col justify-between group cursor-pointer hover:border-primary/50 transition-all border-white/10" mesh meshVariant={insight.variant}>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className={`p-3 rounded-2xl bg-white/10 text-white shadow-inner group-hover:scale-110 transition-transform`}>
                                        <insight.icon className="h-6 w-6" />
                                    </div>
                                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${insight.trend === 'up' ? 'text-green-400 bg-green-400/10' :
                                        insight.trend === 'down' ? 'text-rose-400 bg-rose-400/10' :
                                            'text-slate-400 bg-slate-400/10'
                                        }`}>
                                        {insight.trend === 'up' && <ArrowUpRight className="h-3 w-3" />}
                                        {insight.trend === 'down' && <ArrowDownRight className="h-3 w-3" />}
                                        {insight.trendValue}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-white/50">{insight.label}</h3>
                                    <div className="text-3xl font-black tracking-tighter text-white">{insight.value}</div>
                                </div>
                                <p className="text-xs text-white/60 leading-relaxed">
                                    {insight.description}
                                </p>
                            </div>
                        </GlassCard>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
