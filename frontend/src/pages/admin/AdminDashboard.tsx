import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, UserCheck, Activity, Settings, ShieldCheck, TrendingUp, ArrowUpRight, ClipboardCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { GradientMesh } from '@/components/ui/GradientMesh';
import { GlassCard } from '@/components/ui/GlassCard';
import { motion } from 'framer-motion';

const MOCK_GROWTH_DATA = [
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 700 },
    { name: 'Mar', value: 600 },
    { name: 'Apr', value: 900 },
    { name: 'May', value: 1200 },
    { name: 'Jun', value: 1500 },
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { type: 'spring' as const, stiffness: 100 }
    }
};
import { PredictiveInsights } from '@/components/ui/PredictiveInsights';

const MOCK_ADMIN_INSIGHTS = [
    {
        label: 'Platform Growth',
        value: '14.2k',
        description: 'New user registrations across all districts in the last 30 days.',
        trend: 'up' as const,
        trendValue: '+18.5%',
        icon: Users,
        variant: 'primary' as const
    },
    {
        label: 'System Load',
        value: '22%',
        description: 'Average server resource usage during peak Gaborone clinic hours.',
        trend: 'down' as const,
        trendValue: '-5%',
        icon: Activity,
        variant: 'accent' as const
    },
    {
        label: 'Verification Rate',
        value: '98.8%',
        description: 'Doctor credentials currently awaiting final automated verification.',
        trend: 'neutral' as const,
        trendValue: '0%',
        icon: ShieldCheck,
        variant: 'secondary' as const
    }
];

export const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats] = useState({
        totalUsers: 2540,
        activeDoctors: 120,
        pendingVerifications: 15,
        hospitalCapacity: '85%'
    });

    useEffect(() => {
        // Simulate loading
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="max-w-7xl mx-auto p-6 md:p-8 space-y-8"
        >
            {/* Header / Hero */}
            <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl">
                <GradientMesh variant="primary" className="opacity-40" />
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 p-10 md:p-14">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold tracking-wider uppercase border border-primary/30">
                            <ShieldCheck className="h-4 w-4" />
                            System Administrator
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white">
                            {getGreeting()}, <span className="text-primary">{user?.name}</span>
                        </h1>
                        <p className="text-slate-400 text-lg md:text-xl max-w-2xl font-medium">
                            System vitals are <span className="text-emerald-400 font-bold">Stable</span>. Global uptime is at 99.98% for the current billing cycle.
                        </p>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                        <Button className="flex-1 md:flex-none shadow-lg shadow-primary/20 h-14 px-8 rounded-2xl text-lg font-bold transition-all hover:scale-105 active:scale-95 group">
                            <Activity className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                            Live Metrics
                        </Button>
                        <Button variant="outline" className="flex-1 md:flex-none bg-white/5 border-white/10 text-white hover:bg-white/10 h-14 px-6 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95">
                            <Settings className="h-6 w-6" />
                        </Button>
                    </div>
                </div>
            </motion.div>

            {/* Predictive Intelligence Section */}
            <motion.div variants={itemVariants}>
                <PredictiveInsights insights={MOCK_ADMIN_INSIGHTS} />
            </motion.div>

            {/* Stats Grid */}
            <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <motion.div variants={itemVariants}>
                    <GlassCard className="p-8 flex items-center gap-6" hoverEffect mesh meshVariant="primary">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-primary shadow-inner">
                            <Users className="h-8 w-8" />
                        </div>
                        <div>
                            <div className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-1">Total Network</div>
                            <div className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                                {loading ? '...' : stats.totalUsers.toLocaleString()}
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <GlassCard className="p-8 flex items-center gap-6" hoverEffect mesh meshVariant="secondary">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-500 shadow-inner">
                            <UserCheck className="h-8 w-8" />
                        </div>
                        <div>
                            <div className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-1">Verified Medical</div>
                            <div className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                                {loading ? '...' : stats.activeDoctors}
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <GlassCard className="p-8 flex items-center gap-6" hoverEffect mesh meshVariant="accent">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-500 shadow-inner">
                            <ClipboardCheck className="h-8 w-8" />
                        </div>
                        <div>
                            <div className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-1">Verification Queue</div>
                            <div className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                                {loading ? '...' : stats.pendingVerifications}
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <GlassCard className="p-8 flex items-center gap-6" hoverEffect mesh meshVariant="subtle">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-500 shadow-inner">
                            <TrendingUp className="h-8 w-8" />
                        </div>
                        <div>
                            <div className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-1">Network Capacity</div>
                            <div className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                                {loading ? '...' : stats.hospitalCapacity}
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>
            </motion.div>

            {/* Main Content Areas */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Analytics Chart */}
                <GlassCard className="lg:col-span-2 p-8 space-y-8" mesh meshVariant="primary">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">System Growth</h2>
                            <p className="text-slate-500 font-medium font-medium">New user registrations across all sectors</p>
                        </div>
                        <Badge variant="secondary" className="px-4 py-1.5 rounded-xl font-bold text-primary bg-primary/10 border-primary/20">
                            +24% vs Prev. Month
                        </Badge>
                    </div>

                    <div className="h-[350px] w-full mt-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={MOCK_GROWTH_DATA}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 13, fontWeight: 600 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 13, fontWeight: 600 }}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                                    contentStyle={{
                                        borderRadius: '16px',
                                        border: 'none',
                                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                                        padding: '12px 16px'
                                    }}
                                />
                                <Bar
                                    dataKey="value"
                                    radius={[8, 8, 8, 8]}
                                    barSize={45}
                                >
                                    {MOCK_GROWTH_DATA.map((_, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={index === MOCK_GROWTH_DATA.length - 1 ? 'hsl(var(--primary))' : 'rgba(100, 116, 139, 0.1)'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </GlassCard>

                {/* System Alerts / Logs */}
                <div className="space-y-6">
                    <h2 className="text-xl font-black uppercase tracking-widest text-slate-500">Security Pulse</h2>
                    <div className="space-y-4">
                        {[
                            { title: 'New Provider Auth', desc: 'Dr. Sarah Wilson verified', time: '2m ago', type: 'success' },
                            { title: 'DDoS Mitigation', desc: 'Resolved 2 minute spike', time: '45m ago', type: 'warning' },
                            { title: 'Backup Complete', desc: 'Global shard redundancy', time: '1h ago', type: 'info' },
                        ].map((log, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 + i * 0.1 }}
                            >
                                <GlassCard className="p-5 flex items-start gap-4 hover:border-primary/40 transition-all border-l-4 border-l-primary group">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className="font-bold text-slate-900 dark:text-white truncate">{log.title}</h4>
                                            <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">{log.time}</span>
                                        </div>
                                        <p className="text-sm text-slate-500 font-medium truncate">{log.desc}</p>
                                    </div>
                                    <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />
                                </GlassCard>
                            </motion.div>
                        ))}
                    </div>
                    <Button variant="ghost" className="w-full h-14 rounded-2xl border-dashed border-2 hover:bg-slate-50 hover:border-primary/50 text-slate-500 font-bold">
                        View Audit Vault
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    );
};
