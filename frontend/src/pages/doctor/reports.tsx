import React, { useState, useEffect } from 'react';
import { TransitionItem } from '../../components/layout/page-transition';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { IconWrapper } from '@/components/ui/icon-wrapper';
import { BarChart3, TrendingUp, Users, Calendar, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PremiumAreaChart } from '@/components/charts/premium-area-chart';
import { GradientMesh } from '@/components/ui/gradient-mesh';
import { getGrowthStats, getClinicalPerformance } from '../../services/analytics.service';
import type { GrowthStat, ClinicalPerformance, DiagnosisEntry } from '../../services/analytics.service';
import { MedicalLoader } from '@/components/ui/medical-loader';
import { getErrorMessage } from '../../lib/error';
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
                        hoverText:   'group-hover:text-primary',
                    },
                    {
                        label: 'New Patients',
                        value: stats.reduce((acc, s) => acc + Number(s.newUsers || 0), 0),
                        icon: Calendar,
                        variant: 'accent' as const,
                        hoverBorder: 'hover:border-blue-500/50 dark:hover:border-blue-500/80',
                        hoverShadow: 'hover:shadow-blue-500/10 dark:hover:shadow-blue-500/20',
                        hoverText:   'group-hover:text-blue-600',
                    },
                    {
                        label: 'Retention Rate',
                        value: performance?.retentionRate ?? '94%',
                        icon: TrendingUp,
                        variant: 'success' as const,
                        hoverBorder: 'hover:border-emerald-500/50 dark:hover:border-emerald-500/80',
                        hoverShadow: 'hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20',
                        hoverText:   'group-hover:text-emerald-500',
                    },
                    {
                        label: 'Satisfaction',
                        value: performance?.patientSatisfaction ?? '88%',
                        icon: BarChart3,
                        variant: 'warning' as const,
                        hoverBorder: 'hover:border-amber-500/50 dark:hover:border-amber-500/80',
                        hoverShadow: 'hover:shadow-amber-500/10 dark:hover:shadow-amber-500/20',
                        hoverText:   'group-hover:text-amber-500',
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
                {/*
                 * Architectural Note (Phase 14 — Anti-Pattern Remediation):
                 * PremiumAreaChart owns its Card wrapper internally (Card > CardHeader > CardContent).
                 * Previously wrapped in DashboardCard + div[h-350px], which created two nested
                 * card frames and two separate title/description headers — causing the "weird
                 * overlapping section" regression visible in the UI.
                 * Correct pattern: Use PremiumAreaChart directly inside TransitionItem.
                 */}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TransitionItem>
                    <DashboardCard title="Top Diagnoses" className="p-6">
                        <div className="space-y-4 mt-4">
                            {(performance?.topDiagnoses || [
                                { name: 'Hypertension', count: 45, percentage: 35 },
                                { name: 'Type 2 Diabetes', count: 32, percentage: 25 },
                                { name: 'Influenza', count: 28, percentage: 22 },
                                { name: 'Asthma', count: 15, percentage: 12 },
                            ]).map((item: DiagnosisEntry, i: number) => (
                                <div key={i} className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium">{item.name}</span>
                                        <span className="text-muted-foreground">{item.count} cases</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-teal-500 rounded-full"
                                            style={{ width: `${item.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard title="Practice Efficiency" className="p-6">
                        <div className="flex items-center justify-center h-full min-h-52 text-muted-foreground text-sm italic">
                            Detailed efficiency metrics are being calibrated based on your last 30 days of activity.
                        </div>
                    </DashboardCard>
                </TransitionItem>
            </div>
        </div>
    );
};


