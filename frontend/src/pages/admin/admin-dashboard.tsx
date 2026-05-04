import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
    Users, ShieldCheck, Activity, Server, AlertTriangle,
    Settings, FileText,
    Globe, ShieldAlert, LogOut
} from 'lucide-react';
import { LiveStatusPill } from '@/components/ui/live-status-pill';
import { GradientMesh } from '@/components/ui/gradient-mesh';
import {
    getSystemStats,
    getRevenueStats,
    getActiveSessions,
    getSecurityEvents,
    getAuditLogs,
} from '../../services/admin.service';
import type {
    RevenueStat,
    AuditLog,
} from '../../services/admin.service';
import { TransitionItem } from '../../components/layout/page-transition';
import { PredictiveInsights } from '@/components/ui/predictive-insights';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { IconWrapper } from '@/components/ui/icon-wrapper';
import { MedicalLoader } from '@/components/ui/medical-loader';
import { PATHS } from '../../routes/paths';
import { PremiumBarChart } from '@/components/charts/premium-bar-chart';
import { InstitutionalComposedChart } from '@/components/charts/institutional-composed-chart';
import { useSystemHealth } from '@/hooks/use-system-health';
import { useAdminLiveTable } from '@/hooks/use-admin-live-table';
import { useRelativeTime } from '@/hooks/use-relative-time';
import { socketService } from '@/services/socket.service';
import { logger } from '@/utils/logger';
import {
    UserRegisteredEventSchema,
    SessionCreatedEventSchema,
    SessionRevokedEventSchema,
    DoctorVerifiedEventSchema,
    type UserRegisteredEvent,
    type SessionCreatedEvent,
    type SessionRevokedEvent,
    type DoctorVerifiedEvent,
} from '../../../../shared/schemas/admin-events.schema';

/**
 * 🛡️ HAEMI LIFE — Admin Dashboard (Phase 5: live KPIs + system health)
 *
 * Replaces the static one-shot fetch + hardcoded "34%" placeholder with:
 *   - `useSystemHealth` polling `GET /admin/system-health` every 5 s
 *     (CPU / memory / DB connections / uptime — actual measurements,
 *     not placeholders).
 *   - Live KPI counters subscribing to `user:registered`,
 *     `session:created`, `session:revoked`, `doctor:verified` so the
 *     "Total Users" / "Live Sessions" / "Verification Queue" cards
 *     auto-update without a refresh.
 *   - "Recent Activity" feed via `useAdminLiveTable<AuditLog, 'audit:new'>`
 *     surfacing the last 10 audit entries with live append.
 *
 * Strict-TS posture (project mandate):
 *   - Zero `any`. Zero `as unknown as`. Zero `@ts-ignore`.
 *   - Every socket payload Zod-validated at the consumer boundary
 *     (defense-in-depth against backend drift).
 *   - All errors via `logger`. Zero `console.*`.
 */

const RECENT_ACTIVITY_LIMIT = 10;

interface GrowthDataPoint { name: string; users: number;[key: string]: string | number | undefined; }
const SYSTEM_GROWTH_DATA: GrowthDataPoint[] = [
    { name: 'Jan', users: 1200 },
    { name: 'Feb', users: 1450 },
    { name: 'Mar', users: 1800 },
    { name: 'Apr', users: 2400 },
    { name: 'May', users: 3100 },
    { name: 'Jun', users: 4200 },
];

/**
 * Map a CPU / memory percentage into a qualitative band so the "System
 * Load" card description and trend indicator can read accurately
 * without further math at render time. Thresholds calibrated for a
 * single-instance backend; revisit if horizontal scaling lands.
 */
const classifyLoad = (percent: number): { label: string; trend: 'up' | 'down' | 'neutral'; description: string } => {
    if (percent >= 90) {
        return {
            label: 'Critical',
            trend: 'up',
            description: 'Server capacity is critical. Investigate active workloads immediately.',
        };
    }
    if (percent >= 70) {
        return {
            label: 'Elevated',
            trend: 'up',
            description: 'Server capacity is elevated. Monitor closely; consider scaling.',
        };
    }
    if (percent >= 40) {
        return {
            label: 'Stable',
            trend: 'neutral',
            description: 'Server capacity is healthy and operating within normal range.',
        };
    }
    return {
        label: 'Optimal',
        trend: 'down',
        description: 'Server capacity is optimal with significant headroom available.',
    };
};

const formatUptime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const days = Math.floor(seconds / 86_400);
    const hours = Math.floor((seconds % 86_400) / 3_600);
    const minutes = Math.floor((seconds % 3_600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};

export const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState<boolean>(true);
    const [revenueData, setRevenueData] = useState<RevenueStat[]>([]);
    const [activeSessions, setActiveSessions] = useState<number>(0);
    const [securityAlerts, setSecurityAlerts] = useState<number>(0);
    const [pendingVerifications, setPendingVerifications] = useState<number>(0);
    const [totalUsers, setTotalUsers] = useState<number>(0);

    // Initial fetch — populates all KPI baselines in parallel. Subsequent
    // updates flow via socket events (counters) and polling (system
    // health), not a periodic full refetch.
    useEffect(() => {
        const fetchInitial = async (): Promise<void> => {
            try {
                setLoading(true);
                const [sysStats, revStats, sessions, events] = await Promise.all([
                    getSystemStats(),
                    getRevenueStats(),
                    getActiveSessions(),
                    getSecurityEvents(),
                ]);

                setRevenueData(revStats);
                setActiveSessions(sessions.length);
                setSecurityAlerts(events.filter(e => e.isSuspicious).length);
                setPendingVerifications(sysStats.pendingVerifications);
                setTotalUsers(sysStats.totalUsers);
            } catch (error: unknown) {
                logger.error('[AdminDashboard] Initial fetch failed', {
                    error: error instanceof Error ? error.message : String(error),
                });
            } finally {
                setLoading(false);
            }
        };

        void fetchInitial();
    }, []);

    // Live KPI counter subscriptions. Each handler validates the payload
    // through its literal-named Zod schema (defense-in-depth) before
    // mutating counter state — the runtime invariant matches the
    // architecture established in Phase 1's `useAdminLiveTable`.
    useEffect(() => {
        const onUserRegistered = (payload: UserRegisteredEvent): void => {
            const r = UserRegisteredEventSchema.safeParse(payload);
            if (!r.success) {
                logger.error('[AdminDashboard] user:registered validation failed', {
                    issues: JSON.stringify(r.error.issues),
                });
                return;
            }
            setTotalUsers((prev) => prev + 1);
        };
        const onSessionCreated = (payload: SessionCreatedEvent): void => {
            const r = SessionCreatedEventSchema.safeParse(payload);
            if (!r.success) {
                logger.error('[AdminDashboard] session:created validation failed', {
                    issues: JSON.stringify(r.error.issues),
                });
                return;
            }
            setActiveSessions((prev) => prev + 1);
        };
        const onSessionRevoked = (payload: SessionRevokedEvent): void => {
            const r = SessionRevokedEventSchema.safeParse(payload);
            if (!r.success) {
                logger.error('[AdminDashboard] session:revoked validation failed', {
                    issues: JSON.stringify(r.error.issues),
                });
                return;
            }
            setActiveSessions((prev) => Math.max(0, prev - 1));
        };
        const onDoctorVerified = (payload: DoctorVerifiedEvent): void => {
            const r = DoctorVerifiedEventSchema.safeParse(payload);
            if (!r.success) {
                logger.error('[AdminDashboard] doctor:verified validation failed', {
                    issues: JSON.stringify(r.error.issues),
                });
                return;
            }
            // Verification — approved or rejected — removes the doctor
            // from the pending queue either way.
            setPendingVerifications((prev) => Math.max(0, prev - 1));
        };

        socketService.on('user:registered', onUserRegistered);
        socketService.on('session:created', onSessionCreated);
        socketService.on('session:revoked', onSessionRevoked);
        socketService.on('doctor:verified', onDoctorVerified);

        return () => {
            socketService.off('user:registered', onUserRegistered);
            socketService.off('session:created', onSessionCreated);
            socketService.off('session:revoked', onSessionRevoked);
            socketService.off('doctor:verified', onDoctorVerified);
        };
    }, []);

    // System health polling (5 s cadence; pauses when tab hidden).
    const { health, error: healthError } = useSystemHealth();

    // Recent activity feed — live-streamed via the existing `audit:new`
    // channel. Reuses `useAdminLiveTable` so error / poll-fallback /
    // visibility behaviour stays consistent with the audit logs page.
    const recentActivityFetcher = useCallback(async (): Promise<ReadonlyArray<AuditLog>> => {
        try {
            const page = await getAuditLogs({ limit: RECENT_ACTIVITY_LIMIT, offset: 0 });
            return page.items;
        } catch (error: unknown) {
            logger.error('[AdminDashboard] Recent-activity fetch failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }, []);
    const subscribeEvents = useMemo(() => ['audit:new'] as const, []);

    const { items: recentAuditItems } = useAdminLiveTable<AuditLog, 'audit:new'>({
        fetcher: recentActivityFetcher,
        subscribeEvents,
        // Every audit:new event prepends an entry; we cap the visible
        // slice at RECENT_ACTIVITY_LIMIT so the dashboard surface stays
        // bounded while showing the freshest activity.
        onEvent: (_event, payload, current) => {
            // Defensive narrowing: the union has only `audit:new` here so
            // payload is already AuditLogEvent at the type level. We treat
            // it as the existing AuditLog row shape (compatible columns)
            // for the in-memory list — no cast needed since both shapes
            // share the surface fields the dashboard renders.
            const next: AuditLog = {
                id: payload.id,
                userId: payload.userId,
                action: payload.action,
                entityType: payload.entityType ?? '',
                entityId: payload.entityId ?? '',
                details: payload.details,
                ipAddress: payload.ipAddress ?? '',
                createdAt: payload.createdAt,
                userName: payload.userName ?? undefined,
                userEmail: payload.userEmail ?? undefined,
            };
            // Avoid duplicates if the fetcher already returned this id
            // (race between socket arrival and HTTP response).
            if (current.some((existing) => existing.id === next.id)) return current;
            return [next, ...current].slice(0, RECENT_ACTIVITY_LIMIT);
        },
    });

    // Compose the predictive-insights cards. System Load card now shows
    // the real CPU percentage (rounded server-side) plus a memory hint
    // in the description; falls back to a degraded "Unknown" state if
    // the health fetch has not landed yet (initial page-load window
    // ≤ 5 s) or has errored.
    const insightsData = useMemo(() => {
        let systemLoadValue: string;
        let systemLoadDescription: string;
        let systemLoadTrend: 'up' | 'down' | 'neutral';
        if (health !== null) {
            const classification = classifyLoad(health.cpuPercent);
            systemLoadValue = `${health.cpuPercent}%`;
            systemLoadDescription = `${classification.description} Memory: ${health.memoryPercent}% · DB: ${health.dbConnections.total} connections · Uptime: ${formatUptime(health.uptimeSeconds)}.`;
            systemLoadTrend = classification.trend;
        } else if (healthError !== null) {
            systemLoadValue = '—';
            systemLoadDescription = 'System health metrics unavailable. Monitor will retry automatically.';
            systemLoadTrend = 'neutral';
        } else {
            systemLoadValue = '…';
            systemLoadDescription = 'Sampling system health…';
            systemLoadTrend = 'neutral';
        }

        return [
            {
                label: 'System Load',
                value: systemLoadValue,
                description: systemLoadDescription,
                trend: systemLoadTrend,
                trendValue: health !== null ? classifyLoad(health.cpuPercent).label : 'Pending',
                icon: Server,
                variant: 'primary' as const,
            },
            {
                label: 'Security Shield',
                value: securityAlerts > 0 ? securityAlerts.toString() : 'Active',
                description: securityAlerts > 0 ? `${securityAlerts} suspicious events detected.` : 'No critical threats detected.',
                trend: securityAlerts > 0 ? 'up' as const : 'neutral' as const,
                trendValue: securityAlerts > 0 ? 'Alert' : 'Secure',
                icon: ShieldCheck,
                variant: securityAlerts > 0 ? 'accent' as const : 'secondary' as const,
            },
            {
                label: 'Active Sessions',
                value: activeSessions.toString(),
                description: 'Current authenticated institutional connections.',
                trend: 'neutral' as const,
                trendValue: 'Live',
                icon: Activity,
                variant: 'accent' as const,
            },
        ];
    }, [health, healthError, securityAlerts, activeSessions]);

    const isLiveConnected: boolean = socketService.isConnected();

    if (loading) {
        return <MedicalLoader message="Synchronizing institutional controls..." />;
    }

    return (
        <div className="space-y-8">
            {/* Hero Section - Standardized Premium Style */}
            <TransitionItem className="relative overflow-hidden rounded-[var(--card-radius)] bg-gradient-to-br from-teal-800 to-teal-950 text-white shadow-xl shadow-teal-900/20">
                <GradientMesh variant="primary" className="opacity-20" />
                <div className="relative z-10 p-6 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-3 max-w-2xl">
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-100 text-[11px] font-bold border border-emerald-500/30 backdrop-blur-sm">
                                ADMINISTRATOR ACCESS
                            </div>
                            {/* Inline pulsating live indicator — sits next to the
                                "ADMINISTRATOR ACCESS" pill so the dashboard hero
                                clearly communicates real-time status without
                                dressing the chip as a clickable action. */}
                            <LiveStatusPill isConnected={isLiveConnected} variant="onDark" />
                        </div>
                        <h1 className="page-heading !text-white !mb-0 transition-all duration-300">
                            Welcome, {user?.name}
                        </h1>
                        <p className="text-emerald-50/70 text-sm font-bold uppercase tracking-[0.2em] mb-1">System Overview</p>
                        <div className="page-subheading !text-white/80 !opacity-100 italic">
                            {`Platform is operating normally. All services are online.`}
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full sm:w-auto">
                        <Button
                            size="lg"
                            variant="outline"
                            className="haemi-ignore-click-outside bg-white/10 text-white border-white/20 hover:bg-white hover:text-teal-900 focus-visible:bg-white/10 focus-visible:text-white active:bg-white active:text-teal-900 dark:hover:bg-white/20 dark:hover:text-white dark:focus-visible:bg-white/20 dark:focus-visible:text-white dark:active:bg-white/20 dark:active:text-white shadow-lg h-12 text-sm font-bold rounded-[var(--card-radius)] gap-2 group w-full sm:w-auto transition-all duration-300 hover:scale-105 active:scale-95"
                            onClick={() => navigate(PATHS.ADMIN.SESSIONS)}
                        >
                            <LogOut className="h-5 w-5" aria-hidden="true" />
                            Live Sessions
                        </Button>
                        <Button
                            size="lg"
                            className="bg-white text-teal-900 hover:bg-teal-50 border border-transparent dark:bg-primary dark:text-teal-950 dark:hover:bg-primary/90 shadow-[0_0_20px_rgba(255,255,255,0.3)] dark:shadow-[0_0_20px_rgba(63,194,181,0.3)] h-12 text-sm font-bold rounded-[var(--card-radius)] gap-2 group w-full sm:w-auto transition-all duration-300 hover:scale-105 active:scale-95"
                            onClick={() => navigate(PATHS.ADMIN.SECURITY)}
                        >
                            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                            Security Hub
                        </Button>
                    </div>
                </div>
            </TransitionItem>

            {/* Stats Grid - live counters from socket events. */}
            <section className="grid grid-cols-2 md:grid-cols-3 gap-6" aria-label="Key Metrics">
                <TransitionItem>
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-primary/50 dark:hover:border-primary/80 hover:shadow-lg hover:shadow-primary/10 dark:hover:shadow-primary/20 hover:-translate-y-1 transition-all duration-300 text-center group cursor-pointer" noPadding>
                        <IconWrapper icon={Globe} variant="primary" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                {totalUsers}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-primary transition-colors">Total Users</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-emerald-500/50 dark:hover:border-emerald-500/80 hover:shadow-lg hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20 hover:-translate-y-1 transition-all duration-300 text-center group cursor-pointer" noPadding>
                        <IconWrapper icon={Activity} variant="success" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                {activeSessions}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">Live Sessions</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem className="col-span-2 md:col-span-1">
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-amber-500/50 dark:hover:border-amber-500/80 hover:shadow-lg hover:shadow-amber-500/10 dark:hover:shadow-amber-500/20 hover:-translate-y-1 transition-all duration-300 text-center group cursor-pointer" noPadding>
                        <IconWrapper icon={AlertTriangle} variant="warning" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                {pendingVerifications}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-amber-500 transition-colors">Verification Queue</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>
            </section>

            {/* Predictive Intelligence Section */}
            <TransitionItem>
                <PredictiveInsights insights={insightsData} />
            </TransitionItem>

            {/* Growth & Revenue Analytics Visualization */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <TransitionItem>
                    <PremiumBarChart
                        title="Platform Growth"
                        description="New institutional registrations (Last 6 Months)"
                        data={SYSTEM_GROWTH_DATA}
                        dataKey="users"
                        categoryKey="name"
                        color="#148C8B"
                        valueSuffix=" users"
                        height={350}
                    />
                </TransitionItem>
                <TransitionItem>
                    <InstitutionalComposedChart
                        title="Revenue Analytics"
                        description="Monthly institutional revenue vs operating expenses"
                        data={revenueData}
                        areaKey="revenue"
                        lineKey="expenses"
                        categoryKey="name"
                        areaColor="#148C8B"
                        lineColor="#2563EB"
                        valueSuffix=" BWP"
                        height={350}
                    />
                </TransitionItem>
            </div>

            {/* Recent Activity Feed — live audit log stream (last 10). */}
            <TransitionItem>
                <DashboardCard className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-foreground">Recent Activity</h2>
                            <p className="text-xs text-muted-foreground italic">Live audit log feed</p>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            className="rounded-[var(--card-radius)] text-xs"
                            onClick={() => navigate(PATHS.ADMIN.SYSTEM_LOGS)}
                        >
                            View all
                        </Button>
                    </div>
                    {recentAuditItems.length === 0 ? (
                        <p className="text-center text-muted-foreground italic py-8 text-sm">
                            No audit activity recorded yet.
                        </p>
                    ) : (
                        <ul className="space-y-1">
                            {recentAuditItems.map((entry) => (
                                <RecentActivityRow key={entry.id} entry={entry} />
                            ))}
                        </ul>
                    )}
                </DashboardCard>
            </TransitionItem>

            {/* Quick Actions Grid */}
            <TransitionItem>
                <h2 className="text-xl font-bold mb-4 text-foreground">Institutional Controls</h2>
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                    {[
                        {
                            icon: ShieldAlert,
                            label: "Security Hub",
                            sub: "Monitor events",
                            path: PATHS.ADMIN.SECURITY,
                            color: "text-red-600 bg-red-50 dark:bg-red-900/40 dark:text-red-300",
                            hoverBorder: "hover:border-red-500/50 dark:hover:border-red-400/80",
                            hoverShadow: "hover:shadow-red-500/10 dark:hover:shadow-red-500/20",
                            hoverText: "group-hover:text-red-600 dark:group-hover:text-red-200"
                        },
                        {
                            icon: LogOut,
                            label: "Sessions",
                            sub: "Revoke tokens",
                            path: PATHS.ADMIN.SESSIONS,
                            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 dark:text-emerald-300",
                            hoverBorder: "hover:border-emerald-500/50 dark:hover:border-emerald-400/80",
                            hoverShadow: "hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20",
                            hoverText: "group-hover:text-emerald-600 dark:group-hover:text-emerald-200"
                        },
                        {
                            icon: FileText,
                            label: "Audit Logs",
                            sub: "Forensics",
                            path: PATHS.ADMIN.SYSTEM_LOGS,
                            color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 dark:text-indigo-300",
                            hoverBorder: "hover:border-indigo-500/50 dark:hover:border-indigo-400/80",
                            hoverShadow: "hover:shadow-indigo-500/10 dark:hover:shadow-indigo-500/20",
                            hoverText: "group-hover:text-indigo-600 dark:group-hover:text-indigo-200"
                        },
                        {
                            icon: Users,
                            label: "User Registry",
                            sub: "Manage accounts",
                            path: PATHS.ADMIN.USERS,
                            color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/40 dark:text-cyan-300",
                            hoverBorder: "hover:border-cyan-500/50 dark:hover:border-cyan-400/80",
                            hoverShadow: "hover:shadow-cyan-500/10 dark:hover:shadow-cyan-500/20",
                            hoverText: "group-hover:text-cyan-600 dark:group-hover:text-cyan-200"
                        },
                        {
                            icon: ShieldCheck,
                            label: "Verification",
                            sub: "Approve doctors",
                            path: PATHS.ADMIN.VERIFY_DOCTORS,
                            color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/40 dark:text-emerald-300",
                            hoverBorder: "hover:border-emerald-500/50 dark:hover:border-emerald-400/80",
                            hoverShadow: "hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20",
                            hoverText: "group-hover:text-emerald-600 dark:group-hover:text-emerald-200"
                        },
                        {
                            icon: Settings,
                            label: "Config",
                            sub: "System parameters",
                            path: PATHS.SETTINGS,
                            color: "text-slate-600 bg-slate-50 dark:bg-slate-800/50 dark:text-slate-300",
                            hoverBorder: "hover:border-slate-500/50 dark:hover:border-slate-400/80",
                            hoverShadow: "hover:shadow-slate-500/10 dark:hover:shadow-slate-500/20",
                            hoverText: "group-hover:text-slate-600 dark:group-hover:text-white"
                        },
                    ].map((action, idx) => (
                        <DashboardCard
                            key={idx}
                            className={`flex flex-col items-center justify-center gap-3 p-4 cursor-pointer transition-all duration-300 group hover:-translate-y-1 hover:shadow-lg h-32 text-center ${action.hoverBorder} ${action.hoverShadow}`}
                            noPadding
                            onClick={() => navigate(action.path)}
                        >
                            <div className={`p-3 rounded-full ${action.color} group-hover:scale-110 transition-transform duration-300`}>
                                <action.icon className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                                <span className={`font-semibold text-slate-700 dark:text-slate-200 text-[11px] transition-colors ${action.hoverText}`}>{action.label}</span>
                                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-tight">{action.sub}</span>
                            </div>
                        </DashboardCard>
                    ))}
                </div>
            </TransitionItem>

        </div>
    );
};

/* ─── Internal: recent activity row with live "X ago" ─────────────────────── */

interface RecentActivityRowProps {
    readonly entry: AuditLog;
}

const RecentActivityRow: React.FC<RecentActivityRowProps> = ({ entry }) => {
    const relativeTime: string = useRelativeTime(entry.createdAt, {
        granularity: 'minute',
        fallback: 'Just now',
    });
    return (
        <li className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-b-0 text-sm">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="px-2 py-0.5 rounded-[var(--card-radius)] bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                    {entry.action}
                </span>
                <span className="text-foreground font-medium truncate">{entry.userName ?? 'System'}</span>
                {entry.userEmail && (
                    <span className="text-xs text-muted-foreground truncate hidden sm:inline">{entry.userEmail}</span>
                )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(entry.createdAt).toLocaleString()}>
                {relativeTime}
            </span>
        </li>
    );
};
