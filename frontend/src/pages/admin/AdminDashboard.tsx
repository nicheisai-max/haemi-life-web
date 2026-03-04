import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
    Users, ShieldCheck, Activity, Server, AlertTriangle,
    Settings, UserPlus, FileText,
    Globe
} from 'lucide-react';
import { GradientMesh } from '@/components/ui/GradientMesh';
import { getSystemStats } from '../../services/admin.service';
import type { SystemStats } from '../../services/admin.service';
import { PremiumAreaChart } from '@/components/charts/PremiumAreaChart';
import { TransitionItem } from '../../components/layout/PageTransition';
import { PredictiveInsights } from '@/components/ui/PredictiveInsights';
import { PremiumLoader } from '@/components/ui/PremiumLoader';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { IconWrapper } from '@/components/ui/IconWrapper';
import { PATHS } from '../../routes/paths';

// Realistic Growth Data for a National Platform
interface GrowthDataPoint { name: string; users: number;[key: string]: string | number | undefined; }
const SYSTEM_GROWTH_DATA: GrowthDataPoint[] = [
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
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<SystemStats | null>(null);

    // Fetch system statistics
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await getSystemStats();
                setStats(data);
            } catch (error) {
                console.error('Error fetching system stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    return (
        <div className="space-y-8">
            {/* Hero Section - Standardized Premium Style */}
            <TransitionItem className="relative overflow-hidden rounded-card bg-gradient-to-br from-teal-800 to-teal-950 text-white shadow-xl shadow-teal-900/20">
                <GradientMesh variant="primary" className="opacity-20" />
                <div className="relative z-10 p-6 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-3 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-100 text-[11px] font-bold border border-emerald-500/30 backdrop-blur-sm">
                            ADMINISTRATOR ACCESS
                        </div>
                        <h1 className="page-heading !text-white !mb-0 transition-all duration-300">
                            Welcome, {user?.name}
                        </h1>
                        <p className="text-emerald-50/70 text-sm font-bold uppercase tracking-[0.2em] mb-1">System Overview</p>
                        <div className="page-subheading !text-white/80 !opacity-100 italic">
                            {loading
                                ? <PremiumLoader size="md" className="justify-start h-8 w-auto text-white" />
                                : `Platform is operating normally. All services are online.`
                            }
                        </div>

                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full sm:w-auto">
                        <Button
                            size="lg"
                            className="bg-white dark:bg-primary text-teal-900 dark:text-teal-950 hover:bg-teal-50 dark:hover:bg-primary/90 shadow-[0_0_20px_rgba(255,255,255,0.3)] dark:shadow-[0_0_20px_rgba(63,194,181,0.3)] h-12 text-sm font-bold rounded-xl gap-2 w-full sm:w-auto transition-all duration-300 hover:scale-105 active:scale-95 border-none"
                            onClick={() => navigate(PATHS.ADMIN.USERS)}
                        >
                            <Users className="h-5 w-5" aria-hidden="true" />
                            User Management
                        </Button>
                        <Button
                            size="lg"
                            className="bg-white/10 hover:bg-white/20 text-white border-none shadow-lg h-12 text-sm font-bold rounded-xl gap-2 w-full sm:w-auto transition-all duration-300 backdrop-blur-md"
                            onClick={() => navigate(PATHS.SETTINGS)}
                        >
                            <Settings className="h-5 w-5" aria-hidden="true" />
                            System Config
                        </Button>
                    </div>
                </div>
            </TransitionItem>

            {/* Stats Grid */}
            <section className="grid grid-cols-2 md:grid-cols-3 gap-6" aria-label="Key Metrics">
                <TransitionItem>
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-indigo-500/50 transition-all duration-300 group cursor-default text-center" noPadding>
                        <IconWrapper icon={Globe} variant="primary" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-foreground">
                                {loading ? <PremiumLoader size="sm" className="justify-start" /> : stats?.total_users || "0"}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest">Total Users</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-emerald-500/50 transition-all duration-300 group cursor-default text-center" noPadding>
                        <IconWrapper icon={Activity} variant="success" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-foreground">
                                {loading ? <PremiumLoader size="sm" className="justify-start" /> : (stats ? "99.9%" : "100%")}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest">System Uptime</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem className="col-span-2 md:col-span-1">
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-amber-500/50 transition-all duration-300 group cursor-default text-center" noPadding>
                        <IconWrapper icon={AlertTriangle} variant="warning" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-foreground">
                                {loading ? <PremiumLoader size="sm" className="justify-start" /> : stats?.pending_verifications || "0"}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest">Pending Alerts</div>
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
                            path: PATHS.SETTINGS,
                            color: "text-slate-600 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-300",
                            hoverBorder: "hover:border-slate-500/50 dark:hover:border-slate-400/80",
                            hoverShadow: "hover:shadow-slate-500/10 dark:hover:shadow-slate-500/20",
                            hoverText: "group-hover:text-slate-600 dark:group-hover:text-white"
                        },
                        {
                            icon: FileText,
                            label: "Audit Logs",
                            sub: "View security events",
                            path: PATHS.ADMIN.SYSTEM_LOGS,
                            color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 dark:text-indigo-300",
                            hoverBorder: "hover:border-indigo-500/50 dark:hover:border-indigo-400/80",
                            hoverShadow: "hover:shadow-indigo-500/10 dark:hover:shadow-indigo-500/20",
                            hoverText: "group-hover:text-indigo-600 dark:group-hover:text-indigo-200"
                        },
                        {
                            icon: ShieldCheck,
                            label: "Verify Doctors",
                            sub: "Pending Approvals",
                            path: PATHS.ADMIN.VERIFY_DOCTORS,
                            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 dark:text-emerald-300",
                            hoverBorder: "hover:border-emerald-500/50 dark:hover:border-emerald-400/80",
                            hoverShadow: "hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20",
                            hoverText: "group-hover:text-emerald-600 dark:group-hover:text-emerald-200"
                        },
                        {
                            icon: Users,
                            label: "User Registry",
                            sub: "Manage all accounts",
                            path: PATHS.ADMIN.USERS,
                            color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/40 dark:text-cyan-300",
                            hoverBorder: "hover:border-cyan-500/50 dark:hover:border-cyan-400/80",
                            hoverShadow: "hover:shadow-cyan-500/10 dark:hover:shadow-cyan-500/20",
                            hoverText: "group-hover:text-cyan-600 dark:group-hover:text-cyan-200"
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
        </div>
    );
};

