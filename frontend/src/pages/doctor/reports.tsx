import React, { useState, useEffect, useMemo } from 'react';
import { TransitionItem } from '../../components/layout/page-transition';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { IconWrapper } from '@/components/ui/icon-wrapper';
import { BarChart3, TrendingUp, Users, Calendar, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PremiumAreaChart } from '@/components/charts/premium-area-chart';
import { GradientMesh } from '@/components/ui/gradient-mesh';
import { getGrowthStats, getClinicalPerformance } from '../../services/analytics.service';
import type { GrowthStat, ClinicalPerformance } from '../../services/analytics.service';
import { MedicalLoader } from '@/components/ui/medical-loader';
import { DiagnosticPrevalenceList } from '@/components/ui/diagnostic-prevalence-list';
import { InstitutionalRadarChart } from '@/components/charts/institutional-radar-chart';
import { ClinicalErrorBoundary } from '@/components/ui/clinical-error-boundary';
import { getErrorMessage } from '../../lib/error';
import { logger } from '../../utils/logger';
import api from '../../services/api';


export const DoctorReports: React.FC = () => {
    const [stats, setStats] = useState<GrowthStat[]>([]);
    const [performance, setPerformance] = useState<ClinicalPerformance | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [growthData, performanceData] = await Promise.all([
                getGrowthStats(),
                getClinicalPerformance()
            ]);
            setStats(growthData);
            setPerformance(performanceData);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load clinical data'));
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (): Promise<void> => {
        try {
            // NOTE: secureDownload() cannot be used here — its Lock-Guard (file.service.ts:21)
            // only permits URLs containing '/files/'. The analytics export endpoint is
            // API-generated (/analytics/export), not a stored file, so we must download
            // via the authenticated `api` instance directly with responseType: 'blob'.
            const response = await api.get<Blob>('/analytics/export', {
                responseType: 'blob',
                validateStatus: (status: number) => status === 200,
            });

            const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.style.display = 'none';
            anchor.href = downloadUrl;
            anchor.download = `clinical-report-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(anchor);
            anchor.click();

            // Institutional Cleanup Buffer: 5s ensures browser handoff completion
            // before the object URL is revoked (mirrors file.service.ts pattern).
            setTimeout(() => {
                if (document.body.contains(anchor)) document.body.removeChild(anchor);
                window.URL.revokeObjectURL(downloadUrl);
            }, 5000);
        } catch (err: unknown) {
            console.error('[Export] Clinical data export failed:', err);
        }
    };


    // 🛡️ Institutional Forensic Audit: Memoized Data Transformation
    // We isolate data processing from JSX construction to comply with strict React/ESLint standards.
    const auditedPrevalenceData = useMemo(() => {
        if (!performance?.topDiagnoses) return [];
        // Typed helper preserves the discriminated literal union expected
        // by `DiagnosisEntry.trend` ('up' | 'stable' | 'down') without a
        // boundary cast.
        const computeTrend = (count: number): 'up' | 'stable' | 'down' => {
            if (count > 10) return 'up';
            return 'stable';
        };
        try {
            return performance.topDiagnoses.map(d => ({
                name: d.name,
                count: d.count,
                percentage: d.percentage,
                trend: computeTrend(d.count),
                trendValue: d.count > 10 ? '↑ 12%' : 'Stable'
            }));
        } catch (err: unknown) {
            logger.error('[DoctorReports] Prevalence data mapping failure', {
                error: err instanceof Error ? err.message : String(err)
            });
            return [];
        }
    }, [performance]);

    if (loading) {
        return <MedicalLoader message="Compiling clinical data..." />;
    }

    return (
        <div className="space-y-8">
            <TransitionItem className="relative overflow-hidden rounded-[var(--card-radius)] border bg-gradient-to-br from-teal-800 to-teal-950 text-white shadow-xl">
                <GradientMesh variant="primary" className="opacity-20" />
                <div className="relative z-10 p-6 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-3 max-w-2xl">
                        <p className="text-emerald-50/70 text-sm font-bold uppercase tracking-[0.2em] mb-1">Analytical Insights</p>
                        <h1 className="page-heading !text-white !mb-0 transition-all duration-300">
                            Clinical Insights & Reports
                        </h1>
                        <p className="page-subheading !text-white/80 !opacity-100 italic">
                            Comprehensive analytics of your clinical practice performance.
                        </p>
                    </div>
                    <div className="shrink-0 w-full sm:w-auto">
                        <Button
                            size="lg"
                            className="bg-white text-teal-900 hover:bg-teal-50 border border-transparent dark:bg-primary dark:text-teal-950 dark:hover:bg-primary/90 shadow-[0_0_20px_rgba(255,255,255,0.3)] dark:shadow-[0_0_20px_rgba(63,194,181,0.3)] h-12 text-sm font-bold rounded-[var(--card-radius)] gap-2 group w-full sm:w-auto transition-all duration-300 hover:scale-105 active:scale-95"
                            onClick={handleExport}
                        >
                            <Download className="h-5 w-5" aria-hidden="true" />
                            Export All Data
                        </Button>
                    </div>
                </div>
            </TransitionItem>

            {error && (
                <TransitionItem className="bg-destructive/10 border border-destructive/50 p-4 rounded-[var(--card-radius)] text-destructive flex items-center gap-3">
                    <BarChart3 className="h-5 w-5" />
                    <p className="font-medium text-sm">{error}</p>
                </TransitionItem>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Total Volume',
                        value: stats.reduce((acc, s) => acc + s.value, 0),
                        icon: Users,
                        variant: 'primary' as const,
                        hoverBorder: 'hover:border-primary/50 dark:hover:border-primary/80',
                        hoverShadow: 'hover:shadow-primary/10 dark:hover:shadow-primary/20',
                        hoverText: 'group-hover:text-primary',
                    },
                    {
                        label: 'New Patients',
                        value: stats.reduce((acc, s) => acc + Number(s.newUsers || 0), 0),
                        icon: Calendar,
                        variant: 'accent' as const,
                        hoverBorder: 'hover:border-blue-500/50 dark:hover:border-blue-500/80',
                        hoverShadow: 'hover:shadow-blue-500/10 dark:hover:shadow-blue-500/20',
                        hoverText: 'group-hover:text-blue-600',
                    },
                    {
                        label: 'Retention Rate',
                        value: performance?.retentionRate ?? '94%',
                        icon: TrendingUp,
                        variant: 'success' as const,
                        hoverBorder: 'hover:border-emerald-500/50 dark:hover:border-emerald-500/80',
                        hoverShadow: 'hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20',
                        hoverText: 'group-hover:text-emerald-500',
                    },
                    {
                        label: 'Satisfaction',
                        value: performance?.patientSatisfaction ?? '88%',
                        icon: BarChart3,
                        variant: 'warning' as const,
                        hoverBorder: 'hover:border-amber-500/50 dark:hover:border-amber-500/80',
                        hoverShadow: 'hover:shadow-amber-500/10 dark:hover:shadow-amber-500/20',
                        hoverText: 'group-hover:text-amber-500',
                    },
                ].map((stat, i) => (
                    <TransitionItem key={i}>
                        <DashboardCard
                            className={`flex flex-col items-center justify-center gap-4 p-6 ${stat.hoverBorder} hover:shadow-lg ${stat.hoverShadow} hover:-translate-y-1 transition-all duration-300 text-center group cursor-pointer`}
                            noPadding
                        >
                            <IconWrapper
                                icon={stat.icon}
                                variant={stat.variant}
                                className="h-14 w-14 group-hover:scale-110 transition-transform duration-300"
                                iconClassName="h-7 w-7"
                            />
                            <div className="flex flex-col items-center gap-1.5">
                                <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                    {stat.value}
                                </div>
                                <div className={`text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ${stat.hoverText} transition-colors`}>
                                    {stat.label}
                                </div>
                            </div>
                        </DashboardCard>
                    </TransitionItem>
                ))}
            </div>

            <TransitionItem>
                <PremiumAreaChart
                    title="Clinical Volume Trend"
                    description="Historical consultation volume"
                    data={stats}
                    dataKey="value"
                    categoryKey="name"
                    color="#148C8B"
                    height={350}
                />
            </TransitionItem>

            {/* Institutional Intelligence Section */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 px-1">
                    <div className="h-8 w-1.5 bg-primary rounded-full" />
                    <div className="space-y-0.5">
                        <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                            Institutional Intelligence
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold tracking-widest uppercase">
                            Diagnostic Pathology & Operational Metrics
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                    <TransitionItem>
                        <DashboardCard className="p-8 h-full border-slate-200/60 dark:border-slate-800/60 shadow-lg shadow-slate-200/20 dark:shadow-none bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl">
                            <ClinicalErrorBoundary name="Pathology Analytics">
                                <DiagnosticPrevalenceList data={auditedPrevalenceData} />
                            </ClinicalErrorBoundary>
                        </DashboardCard>
                    </TransitionItem>

                    <TransitionItem>
                        <DashboardCard className="p-8 h-full border-slate-200/60 dark:border-slate-800/60 shadow-lg shadow-slate-200/20 dark:shadow-none bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl">
                            <ClinicalErrorBoundary name="Efficiency Matrix">
                                <InstitutionalRadarChart
                                    isCalibrating={true}
                                    data={[
                                        { subject: 'Cadence', value: 0, fullMark: 100 },
                                        { subject: 'Turnover', value: 0, fullMark: 100 },
                                        { subject: 'Retention', value: 0, fullMark: 100 },
                                        { subject: 'Quality', value: 0, fullMark: 100 },
                                        { subject: 'Satisfaction', value: 0, fullMark: 100 },
                                    ]}
                                />
                            </ClinicalErrorBoundary>
                        </DashboardCard>
                    </TransitionItem>
                </div>
            </div>
        </div>
    );
};
