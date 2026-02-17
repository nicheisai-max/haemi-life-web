import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import {
    Users, Activity, ShieldCheck, AlertTriangle, FileText,
    Server, Settings, Lock, Database, Globe
} from 'lucide-react';
import { GradientMesh } from '@/components/ui/GradientMesh';
import { PremiumAreaChart } from '@/components/charts/PremiumAreaChart';
import { PredictiveInsights } from '@/components/ui/PredictiveInsights';
import { TransitionItem } from '../../components/layout/PageTransition';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { IconWrapper } from '@/components/ui/IconWrapper';

const MOCK_GROWTH_DATA = [
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 300 },
    { name: 'Mar', value: 550 },
    { name: 'Apr', value: 480 },
    { name: 'May', value: 650 },
    { name: 'Jun', value: 780 },
];

const MOCK_ADMIN_INSIGHTS = [
    {
        label: 'System Load',
        value: '34%',
        description: 'Server capacity is optimal. Peak usage predicted at 14:00.',
        trend: 'stable' as const,
        trendValue: '+2%',
        icon: Server,
        variant: 'primary' as const
    },
    {
        label: 'Security Threats',
        value: '0',
        description: 'No active threats detected in the last 24 hours.',
        trend: 'stable' as const,
        trendValue: 'Clean',
        icon: ShieldCheck,
        variant: 'success' as const
    },
    {
        label: 'User Growth',
        value: '+12%',
        description: 'New user registrations are trending upwards across all regions.',
        trend: 'up' as const,
        trendValue: '+154',
        icon: Users,
        variant: 'accent' as const
    }
];

export const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [systemStatus] = useState<'healthy' | 'warning' | 'critical'>('healthy');

    return (
        <div className="w-full mx-auto p-4 md:p-8 max-w-[1920px] space-y-8">
            {/* Hero Section */}
            <TransitionItem className="relative overflow-hidden rounded-3xl border bg-slate-900 text-white shadow-xl">
                <GradientMesh variant="accent" className="opacity-40" />
                <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold border border-blue-500/30">
                            <ShieldCheck className="h-3 w-3 fill-current" />
                            System Status: Operational
                        </div>
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                            Admin Console
                        </h1>
                        <p className="text-white/70 text-base font-medium leading-relaxed">
                            System integrity is at 100%. Managing {MOCK_GROWTH_DATA[5].value} active users across the platform.
                        </p>
                    </div>
                    <div className="flex gap-3 shrink-0">
                        <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg px-6 h-11 text-sm font-bold rounded-xl gap-2"
                        >
                            <FileText className="h-4 w-4" />
                            Generate Report
                        </Button>
                    </div>
                </div>
            </TransitionItem>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <TransitionItem>
                    <DashboardCard className="flex items-center gap-4">
                        <IconWrapper icon={Users} variant="primary" />
                        <div>
                            <div className="text-3xl font-bold tracking-tight text-foreground">12,450</div>
                            <div className="text-sm font-medium text-muted-foreground">Total Users</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex items-center gap-4">
                        <IconWrapper icon={Activity} variant="success" />
                        <div>
                            <div className="text-3xl font-bold tracking-tight text-foreground">99.9%</div>
                            <div className="text-sm font-medium text-muted-foreground">Uptime</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex items-center gap-4">
                        <IconWrapper icon={AlertTriangle} variant="warning" />
                        <div>
                            <div className="text-3xl font-bold tracking-tight text-foreground">5</div>
                            <div className="text-sm font-medium text-muted-foreground">Pending Alerts</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>
            </div>

            {/* AI Insights */}
            <TransitionItem>
                <PredictiveInsights insights={MOCK_ADMIN_INSIGHTS} />
            </TransitionItem>

            {/* Charts & Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <TransitionItem className="lg:col-span-2">
                    <PremiumAreaChart
                        title="System Growth"
                        description="New user registrations across all sectors"
                        data={MOCK_GROWTH_DATA}
                        dataKey="value"
                        categoryKey="name"
                        color="#3FC2B5"
                        height={350}
                    />
                </TransitionItem>

                <div className="space-y-6">
                    <TransitionItem>
                        <h2 className="text-xl font-semibold mb-4 text-foreground">Quick Actions</h2>
                        <div className="space-y-3">
                            <DashboardCard
                                className="flex items-center gap-4 p-4 cursor-pointer hover:border-primary/50 transition-colors"
                                noPadding
                            >
                                <IconWrapper icon={Settings} className="h-10 w-10 text-muted-foreground bg-muted" />
                                <div>
                                    <div className="font-semibold text-foreground">Global Settings</div>
                                    <div className="text-xs text-muted-foreground">Configure system parameters</div>
                                </div>
                            </DashboardCard>

                            <DashboardCard
                                className="flex items-center gap-4 p-4 cursor-pointer hover:border-primary/50 transition-colors"
                                noPadding
                            >
                                <IconWrapper icon={Lock} className="h-10 w-10 text-muted-foreground bg-muted" />
                                <div>
                                    <div className="font-semibold text-foreground">Security Audit</div>
                                    <div className="text-xs text-muted-foreground">Review access logs</div>
                                </div>
                            </DashboardCard>

                            <DashboardCard
                                className="flex items-center gap-4 p-4 cursor-pointer hover:border-primary/50 transition-colors"
                                noPadding
                            >
                                <IconWrapper icon={Database} className="h-10 w-10 text-muted-foreground bg-muted" />
                                <div>
                                    <div className="font-semibold text-foreground">Backup & Restore</div>
                                    <div className="text-xs text-muted-foreground">Manage data redundancy</div>
                                </div>
                            </DashboardCard>
                        </div>
                    </TransitionItem>

                    <TransitionItem>
                        <h2 className="text-xl font-semibold mb-4 text-foreground">System Health</h2>
                        <DashboardCard className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Server className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">API Server</span>
                                </div>
                                <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">Healthy</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Database className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">PostgreSQL</span>
                                </div>
                                <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">Healthy</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">CDN / Assets</span>
                                </div>
                                <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">Healthy</span>
                            </div>
                        </DashboardCard>
                    </TransitionItem>
                </div>
            </div>
        </div>
    );
};
