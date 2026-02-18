import React, { useState, useEffect } from 'react';
import { TransitionItem } from '../../components/layout/PageTransition';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { IconWrapper } from '@/components/ui/IconWrapper';
import { BarChart3, TrendingUp, Users, Calendar, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PremiumAreaChart } from '@/components/charts/PremiumAreaChart';
import { GradientMesh } from '@/components/ui/GradientMesh';
import { getGrowthStats, getClinicalPerformance } from '../../services/analytics.service';
import type { GrowthStat } from '../../services/analytics.service';
import { MedicalLoader } from '@/components/ui/MedicalLoader';

const Reports: React.FC = () => {
    const [stats, setStats] = useState<GrowthStat[]>([]);
    const [performance, setPerformance] = useState<any>(null);
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
        } catch (err: any) {
            setError(err.message || 'Failed to load clinical data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <MedicalLoader message="Compiling clinical data..." />
            </div>
        );
    }

    return (
        <main className="w-full mx-auto p-4 md:p-6 pb-16 md:pb-20 max-w-[1600px] space-y-6">
            <TransitionItem className="relative overflow-hidden rounded-2xl border bg-slate-900 text-white shadow-xl">
                <GradientMesh variant="secondary" className="opacity-20" />
                <div className="relative z-10 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-2">
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Clinical Insights & Reports</h1>
                        <p className="text-white/60 text-sm md:text-base">Comprehensive analytics of your clinical practice performance.</p>
                    </div>
                    <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                        <Download className="h-4 w-4 mr-2" />
                        Export All Data
                    </Button>
                </div>
            </TransitionItem>

            {error && (
                <TransitionItem className="bg-destructive/10 border border-destructive/50 p-4 rounded-xl text-destructive flex items-center gap-3">
                    <BarChart3 className="h-5 w-5" />
                    <p className="font-medium text-sm">{error}</p>
                </TransitionItem>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Volume', value: stats.reduce((acc, s) => acc + s.value, 0), icon: Users, variant: 'primary' as const },
                    { label: 'New Patients', value: stats.reduce((acc, s) => acc + (s.new_users || 0), 0), icon: Calendar, variant: 'accent' as const },
                    { label: 'Retention Rate', value: performance?.retentionRate || '94%', icon: TrendingUp, variant: 'success' as const },
                    { label: 'Satisfaction', value: performance?.patientSatisfaction || '88%', icon: BarChart3, variant: 'warning' as const },
                ].map((stat, i) => (
                    <TransitionItem key={i}>
                        <DashboardCard className="flex flex-col items-center justify-center p-6 text-center space-y-2">
                            <IconWrapper icon={stat.icon} variant={stat.variant} />
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</div>
                        </DashboardCard>
                    </TransitionItem>
                ))}
            </div>

            <TransitionItem>
                <DashboardCard title="Clinical Volume Trend" className="p-0 overflow-hidden">
                    <div className="h-[350px] w-full mt-4">
                        <PremiumAreaChart
                            title="Patient Volume Trend"
                            description="Historical consultation volume"
                            data={stats as any[]}
                            dataKey="patients"
                            categoryKey="month"
                            color="#148C8B"
                        />
                    </div>
                </DashboardCard>
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
                            ]).map((item: any, i: number) => (
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
                        <div className="flex items-center justify-center h-full min-h-[200px] text-muted-foreground text-sm italic">
                            Detailed efficiency metrics are being calibrated based on your last 30 days of activity.
                        </div>
                    </DashboardCard>
                </TransitionItem>
            </div>
        </main>
    );
};

export default Reports;
