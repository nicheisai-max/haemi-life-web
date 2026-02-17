import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
    Users, ShieldCheck, Activity, Server, AlertTriangle,
    Settings, UserPlus, FileText, Lock, Database,
    Globe
} from 'lucide-react';
import { GradientMesh } from '@/components/ui/GradientMesh';
import { PremiumAreaChart } from '@/components/charts/PremiumAreaChart';
import { TransitionItem } from '../../components/layout/PageTransition';
import { PredictiveInsights } from '@/components/ui/PredictiveInsights';
import { MedicalLoader } from '@/components/ui/MedicalLoader';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { IconWrapper } from '@/components/ui/IconWrapper';
import { PATHS } from '../../routes/paths';

// Realistic Growth Data for a National Platform
const SYSTEM_GROWTH_DATA = [
    { name: 'Jan', users: 1200 },
    { name: 'Feb', users: 1450 },
    { name: 'Mar', users: 1800 },
    { name: 'Apr', users: 2400 },
    { name: 'May', users: 3100 },
    { name: 'Jun', users: 4200 },
];

const ADMIN_INSIGHTS_DATA = [
    {
        label: 'System Load',
        value: '34%',
        description: 'Server capacity is optimal. Peak load expected at 09:00 CAT.',
        trend: 'neutral' as const, // Fixed: stable -> neutral
        trendValue: 'Normal',
        icon: Server,
        variant: 'primary' as const
    },
    {
        label: 'Security Alerts',
        value: '0',
        description: 'No active threats detected in the last 24 hours.',
        trend: 'up' as const,
        trendValue: 'Secure',
        icon: ShieldCheck,
        variant: 'secondary' as const
    },
    {
        label: 'New Registrations',
        value: '+128',
        description: 'Doctor onboarding up by 15% this week.',
        trend: 'up' as const,
        trendValue: '+15%',
        icon: UserPlus,
        variant: 'accent' as const
    }
];

export const AdminDashboard: React.FC = () => {
    // const { user } = useAuth(); // Unused
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    // Simulate data fetching
    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <main className="w-full mx-auto p-4 md:p-8 max-w-[1920px] space-y-8">
            {/* Hero Section */}
            <TransitionItem className="relative overflow-hidden rounded-3xl border bg-slate-900 text-white shadow-xl">
                <GradientMesh variant="accent" className="opacity-40" />
                <div className="relative z-10 p-6 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-3 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-bold border border-indigo-500/30 backdrop-blur-sm">
                            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                            ADMINISTRATOR ACCESS
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
                            System Overview
                        </h1>
                        <p className="text-white/80 text-lg font-medium leading-relaxed">
                            {loading
                                ? <MedicalLoader message="Monitoring system health..." />
                                : `Platform is operating normally. All services are online.`
                            }
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full sm:w-auto">
                        <Button
                            size="lg"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg h-12 text-sm font-bold rounded-xl gap-2 w-full sm:w-auto"
                            onClick={() => navigate(PATHS.ADMIN.USERS)}
                        >
                            <Users className="h-5 w-5" aria-hidden="true" />
                            User Management
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="bg-white/10 hover:bg-white/20 text-white border-white/20 shadow-lg h-12 text-sm font-bold rounded-xl gap-2 w-full sm:w-auto"
                            onClick={() => navigate(PATHS.SETTINGS)}
                        >
                            <Settings className="h-5 w-5" aria-hidden="true" />
                            System Config
                        </Button>
                    </div>
                </div>
            </TransitionItem>

            {/* Stats Grid */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6" aria-label="Key Metrics">
                <TransitionItem>
                    <DashboardCard className="flex items-center gap-5 hover:border-indigo-500/50 transition-colors cursor-default">
                        <IconWrapper icon={Globe} variant="primary" className="h-14 w-14" iconClassName="h-7 w-7" />
                        <div>
                            <div className="text-4xl font-bold tracking-tight text-foreground">
                                {loading ? <MedicalLoader message="Counting..." /> : "12,450"}
                            </div>
                            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Total Users</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex items-center gap-5 hover:border-emerald-500/50 transition-colors cursor-default">
                        <IconWrapper icon={Activity} variant="success" className="h-14 w-14" iconClassName="h-7 w-7" />
                        <div>
                            <div className="text-4xl font-bold tracking-tight text-foreground">
                                {loading ? <MedicalLoader message="Syncing..." /> : "99.9%"}
                            </div>
                            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">System Uptime</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex items-center gap-5 hover:border-amber-500/50 transition-colors cursor-default">
                        <IconWrapper icon={AlertTriangle} variant="warning" className="h-14 w-14" iconClassName="h-7 w-7" />
                        <div>
                            <div className="text-4xl font-bold tracking-tight text-foreground">
                                {loading ? <MedicalLoader message="Auditing..." /> : "3"}
                            </div>
                            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pending Alerts</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>
            </section>

            {/* Predictive Intelligence Section */}
            <TransitionItem>
                <PredictiveInsights insights={ADMIN_INSIGHTS_DATA} />
            </TransitionItem>

            {/* Growth Analytics Visualization */}
            <TransitionItem>
                <PremiumAreaChart
                    title="Platform Growth"
                    description="New user registrations over the last 6 months"
                    data={SYSTEM_GROWTH_DATA}
                    dataKey="users"
                    categoryKey="name"
                    color="#6366f1" // Indigo-500
                    valueSuffix=" users"
                    height={350}
                />
            </TransitionItem>

            {/* Quick Actions Grid */}
            <TransitionItem>
                <h2 className="text-xl font-bold mb-4 text-foreground">System Actions</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        {
                            icon: Settings,
                            label: "Global Settings",
                            sub: "Configure system",
                            path: "/admin/settings",
                            color: "text-slate-600 bg-slate-50 dark:bg-slate-800",
                            hoverBorder: "hover:border-slate-500/50 dark:hover:border-slate-500/80",
                            hoverShadow: "hover:shadow-slate-500/10 dark:hover:shadow-slate-500/20",
                            hoverText: "group-hover:text-slate-600"
                        },
                        {
                            icon: FileText,
                            label: "Audit Logs",
                            sub: "View security events",
                            path: "/admin/logs",
                            color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20",
                            hoverBorder: "hover:border-indigo-500/50 dark:hover:border-indigo-500/80",
                            hoverShadow: "hover:shadow-indigo-500/10 dark:hover:shadow-indigo-500/20",
                            hoverText: "group-hover:text-indigo-600"
                        },
                        {
                            icon: Lock,
                            label: "Security Policy",
                            sub: "Manage RBAC & Access",
                            path: "/admin/security",
                            color: "text-rose-600 bg-rose-50 dark:bg-rose-900/20",
                            hoverBorder: "hover:border-rose-500/50 dark:hover:border-rose-500/80",
                            hoverShadow: "hover:shadow-rose-500/10 dark:hover:shadow-rose-500/20",
                            hoverText: "group-hover:text-rose-600"
                        },
                        {
                            icon: Database,
                            label: "Database",
                            sub: "Backups & health",
                            path: "/admin/database",
                            color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20",
                            hoverBorder: "hover:border-cyan-500/50 dark:hover:border-cyan-500/80",
                            hoverShadow: "hover:shadow-cyan-500/10 dark:hover:shadow-cyan-500/20",
                            hoverText: "group-hover:text-cyan-600"
                        },
                    ].map((action, idx) => (
                        <DashboardCard
                            key={idx}
                            className={`flex flex-col items-center justify-center gap-3 p-4 cursor-pointer transition-all duration-300 group hover:-translate-y-1 hover:shadow-lg h-32 text-center ${action.hoverBorder} ${action.hoverShadow}`}
                            noPadding
                            onClick={() => navigate(action.path)}
                        >
                            <div className={`p-3 rounded-full ${action.color} group-hover:scale-110 transition-transform duration-300`}>
                                <action.icon className="h-6 w-6" />
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                                <span className={`font-semibold text-slate-700 dark:text-slate-200 text-sm transition-colors ${action.hoverText}`}>{action.label}</span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">{action.sub}</span>
                            </div>
                        </DashboardCard>
                    ))}
                </div>
            </TransitionItem>
        </main>
    );
};
