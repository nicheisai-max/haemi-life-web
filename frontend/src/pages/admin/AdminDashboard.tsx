import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Button } from '@/components/ui/button';
import { Users, UserCheck, Activity, Settings, ShieldCheck, TrendingUp, ArrowUpRight, ClipboardCheck } from 'lucide-react';
import { GradientMesh } from '@/components/ui/GradientMesh';
import { GlassCard } from '@/components/ui/GlassCard';
import { PremiumAreaChart } from '@/components/charts/PremiumAreaChart';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PremiumStatCard } from '@/components/ui/PremiumStatCard';
import { Loader } from '@/components/ui/Loader';

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
    const [growthData, setGrowthData] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch growth data
                // Fetch growth data
                const response = await api.get('/analytics/growth');
                setGrowthData(response.data);
            } catch (error) {
                console.error('Failed to fetch analytics', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);



    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="max-w-7xl mx-auto p-6 md:p-8 space-y-8"
        >
            {/* Header / Hero */}
            <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl">
                <GradientMesh variant="primary" className="opacity-40" />
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold tracking-wider uppercase border border-primary/20">
                            <ShieldCheck className="h-3 w-3" />
                            System Administrator
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                            Hi, <span className="text-primary">{user?.name}</span>
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                            System vitals are <span className="text-emerald-500 font-bold">Stable</span>. 99.98% uptime.
                        </p>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        <Button className="flex-1 md:flex-none h-11 px-6 rounded-xl text-sm font-bold shadow-md">
                            <Activity className="mr-2 h-4 w-4" />
                            Live Metrics
                        </Button>
                        <Button variant="outline" className="flex-1 md:flex-none h-11 px-4 rounded-xl shadow-sm">
                            <Settings className="h-5 w-5" />
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
                    <PremiumStatCard
                        icon={Users}
                        label="Total Network"
                        value={loading ? <Loader size="xs" /> : stats.totalUsers.toLocaleString()}
                        trend="up"
                        trendValue="+12%"
                    />
                </motion.div>
                <motion.div variants={itemVariants}>
                    <PremiumStatCard
                        icon={UserCheck}
                        label="Verified Medical"
                        value={loading ? <Loader size="xs" /> : stats.activeDoctors}
                        trend="up"
                        trendValue="+5"
                    />
                </motion.div>
                <motion.div variants={itemVariants}>
                    <PremiumStatCard
                        icon={ClipboardCheck}
                        label="Verification Queue"
                        value={loading ? <Loader size="xs" /> : stats.pendingVerifications}
                        trend="neutral"
                        trendValue="Stable"
                    />
                </motion.div>
                <motion.div variants={itemVariants}>
                    <PremiumStatCard
                        icon={TrendingUp}
                        label="Network Capacity"
                        value={loading ? <Loader size="xs" /> : stats.hospitalCapacity}
                        trend="up"
                        trendValue="+2%"
                    />
                </motion.div>
            </motion.div>

            {/* Main Content Areas */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Analytics Chart */}
                <div className="lg:col-span-2">
                    <PremiumAreaChart
                        title="System Growth"
                        description="New user registrations across all sectors"
                        data={growthData}
                        dataKey="value"
                        categoryKey="name"
                        color="#3FC2B5"
                        height={350}
                    />
                </div>

                {/* System Alerts / Logs */}
                <div className="space-y-6">
                    <h2 className="text-xl font-black uppercase tracking-widest text-slate-500">Security Pulse</h2>
                    <div className="space-y-4">
                        {[
                            { title: 'New Provider Auth', desc: 'Dr. Sarah Wilson verified', time: '2m ago', type: 'success', user: 'Dr. Sarah Wilson' },
                            { title: 'DDoS Mitigation', desc: 'Resolved 2 minute spike', time: '45m ago', type: 'warning', user: 'System' },
                            { title: 'Backup Complete', desc: 'Global shard redundancy', time: '1h ago', type: 'info', user: 'System' },
                        ].map((log, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 + i * 0.1 }}
                            >
                                <GlassCard className="p-5 flex items-start gap-4 hover:border-primary/40 transition-all border-l-4 border-l-primary group">
                                    <div className="shrink-0 mt-1">
                                        <Avatar className="h-8 w-8 border border-border">
                                            <AvatarImage
                                                src={`/images/doctors/${log.user?.toLowerCase().replace(/[^a-z0-9]/g, '_')}.svg`}
                                                alt={log.user}
                                            />
                                            <AvatarFallback className="text-[10px] font-bold">
                                                {log.user?.slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
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
                    <Button variant="ghost" className="w-full h-14 rounded-2xl border-dashed border-2 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-primary/50 text-slate-500 dark:text-slate-400 dark:hover:text-white font-bold transition-colors">
                        View Audit Vault
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    );
};
