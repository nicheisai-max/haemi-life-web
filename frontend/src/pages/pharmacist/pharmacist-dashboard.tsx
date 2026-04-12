import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
    Pill, Receipt, ClipboardList, CheckCircle2, AlertOctagon,
    QrCode, History, Truck,
    Filter, RefreshCw
} from 'lucide-react';
import { GradientMesh } from '@/components/ui/gradient-mesh';
import { PremiumLoader } from '@/components/ui/premium-loader';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { IconWrapper } from '@/components/ui/icon-wrapper';
import { MedicalLoader } from '@/components/ui/medical-loader';
import { PATHS } from '../../routes/paths';
import { TransitionItem } from '../../components/layout/page-transition';
import { PremiumPieChart } from '../../components/charts/premium-pie-chart';
import { getAllPrescriptions } from '../../services/prescription.service';
import type { Prescription } from '../../services/prescription.service';

const INVENTORY_METRICS = [
    { name: 'Antibiotics', value: 35, color: '#0E6B74' }, // Primary-800
    { name: 'Analgesics', value: 25, color: '#1BA7A6' }, // Primary-600
    { name: 'Chronics', value: 30, color: '#3FC2B5' },   // Primary-500
    { name: 'Topicals', value: 10, color: '#A7E6DB' },   // Primary-300
];

export const PharmacistDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getAllPrescriptions();
            setPrescriptions(data);
        } catch (err) {
            const apiError = err as { response?: { data?: { message?: string } } };
            setError(apiError.response?.data?.message || 'Failed to load prescriptions');
            console.error('Pharmacist dashboard error:', err);
        } finally {
            setLoading(false);
        }
    };

    const pendingOrders = prescriptions.filter(p => p.status === 'pending');
    const completedOrdersValue = prescriptions.filter(p => p.status === 'filled').length;

    if (loading) {
        return <MedicalLoader message="Synchronizing regional prescription queue..." />;
    }

    return (
        <div className="space-y-8">
            {/* Hero Section - Standardized Premium Style */}
            <TransitionItem className="relative overflow-hidden rounded-[var(--card-radius)] bg-gradient-to-br from-teal-800 to-teal-950 text-white shadow-xl shadow-teal-900/20">
                <GradientMesh variant="primary" className="opacity-20" />
                <div className="relative z-10 p-6 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-3 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-100 text-[11px] font-bold border border-emerald-500/30 backdrop-blur-sm">
                            PHARMACY DISPENSARY
                        </div>
                        <h1 className="page-heading !text-white !mb-0 transition-all duration-300">
                            Welcome, {user?.name}
                        </h1>
                        <p className="text-emerald-50/70 text-sm font-bold uppercase tracking-[0.2em] mb-1">Dispensing Queue</p>
                        <div className="page-subheading !text-white/80 !opacity-100 italic">
                            {loading
                                ? <PremiumLoader size="md" className="justify-start h-8 w-auto text-white" />
                                : `You have ${pendingOrders.length} prescriptions pending verification and dispensing.`
                            }
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full sm:w-auto">
                        <Button
                            size="lg"
                            variant="outline"
                            className="haemi-ignore-click-outside bg-white/10 text-white border-white/20 hover:bg-white hover:text-teal-900 focus-visible:bg-white/10 focus-visible:text-white active:bg-white active:text-teal-900 dark:hover:bg-white/20 dark:hover:text-white dark:focus-visible:bg-white/20 dark:focus-visible:text-white dark:active:bg-white/20 dark:active:text-white shadow-lg h-12 text-sm font-bold rounded-[var(--card-radius)] gap-2 group w-full sm:w-auto transition-all duration-300 hover:scale-105 active:scale-95"
                            onClick={() => navigate(PATHS.PHARMACIST.INVENTORY)}
                        >
                            <ClipboardList className="h-5 w-5" aria-hidden="true" />
                            Inventory
                        </Button>
                        <Button
                            size="lg"
                            className="bg-white text-teal-900 hover:bg-teal-50 border border-transparent dark:bg-primary dark:text-teal-950 dark:hover:bg-primary/90 shadow-[0_0_20px_rgba(255,255,255,0.3)] dark:shadow-[0_0_20px_rgba(63,194,181,0.3)] h-12 text-sm font-bold rounded-[var(--card-radius)] gap-2 group w-full sm:w-auto transition-all duration-300 hover:scale-105 active:scale-95"
                            onClick={() => navigate(PATHS.PHARMACIST.DISPENSE)}
                        >
                            <QrCode className="h-5 w-5" aria-hidden="true" />
                            Scan QR Code
                        </Button>
                    </div>
                </div>
            </TransitionItem>

            {error && (
                <TransitionItem className="rounded-[var(--card-radius)] border border-destructive/50 bg-destructive/10 p-4 text-destructive flex items-center gap-3" role="alert">
                    <AlertOctagon className="h-5 w-5" aria-hidden="true" />
                    <p className="text-sm font-medium">{error}</p>
                </TransitionItem>
            )}

            {/* Stats Grid - Standardized Premium UX (v8.6 Pharmacist Sync) */}
            <section className="grid grid-cols-2 md:grid-cols-3 gap-6" aria-label="Key Metrics">
                <TransitionItem>
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-primary/50 dark:hover:border-primary/80 hover:shadow-lg hover:shadow-primary/10 dark:hover:shadow-primary/20 hover:-translate-y-1 transition-all duration-300 text-center group cursor-pointer" noPadding>
                        <IconWrapper icon={Receipt} variant="primary" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                {loading ? <PremiumLoader size="sm" className="h-9" /> : pendingOrders.length}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-primary transition-colors">Active Queue</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-emerald-500/50 dark:hover:border-emerald-500/80 hover:shadow-lg hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20 hover:-translate-y-1 transition-all duration-300 text-center group cursor-pointer" noPadding>
                        <IconWrapper icon={CheckCircle2} variant="success" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                {loading ? <PremiumLoader size="sm" className="h-9" /> : completedOrdersValue}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">Dispensed Today</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem className="col-span-2 md:col-span-1">
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-amber-500/50 dark:hover:border-amber-500/80 hover:shadow-lg hover:shadow-amber-500/10 dark:hover:shadow-amber-500/20 hover:-translate-y-1 transition-all duration-300 text-center group cursor-pointer" noPadding>
                        <IconWrapper icon={Truck} variant="warning" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                {loading ? <PremiumLoader size="sm" className="h-9" /> : "12"}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-amber-500 transition-colors">Stock Arrivals</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>
            </section>

            {/* Main Content Hub - Institutional Compaction Certification v10.7 */}
            <TransitionItem className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.2fr_1fr_0.8fr] gap-8 items-stretch h-[42vh] min-h-[350px]">
                {/* Column 1: Pending Prescriptions (Synchronized Skeleton) */}
                <section className="flex flex-col h-full min-h-0 overflow-hidden group/col">
                    <div className="flex items-center justify-between mb-4 h-8 shrink-0">
                        <h2 className="text-xl font-bold text-foreground">Pending Prescriptions</h2>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Filter prescriptions">
                                <Filter className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={fetchData} aria-label="Refresh list">
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 h-full overflow-y-auto pr-2 pb-0 scrollbar-thin scrollbar-thumb-border/50">
                        {loading ? (
                            <div className="flex justify-center p-12 h-full items-center">
                                <PremiumLoader size="md" />
                            </div>
                        ) : pendingOrders.length === 0 ? (
                            <DashboardCard className="text-center text-muted-foreground flex flex-col items-center justify-center border-dashed h-full transition-all duration-300 hover:border-primary-500/50 hover:shadow-lg hover:-translate-y-1">
                                <CheckCircle2 className="h-12 w-12 opacity-20 mb-3" />
                                <p className="font-medium text-sm">All clear!</p>
                                <p className="text-[12px] opacity-75 mt-1">No pending prescriptions in the queue.</p>
                            </DashboardCard>
                        ) : (
                            <div className="space-y-3 pb-4">
                                {pendingOrders.map((prescription) => (
                                    <DashboardCard key={prescription.id} className="group p-4 flex items-center gap-4 transition-all duration-300 hover:border-primary-500/50 hover:shadow-md">
                                        <div className="bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-[var(--card-radius)] p-2 w-16 text-center shrink-0 border border-primary-100 dark:border-primary-900/50">
                                            <span className="block text-xs font-bold uppercase tracking-wider">New</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold truncate text-foreground">{prescription.patientName || 'Patient'}</h3>
                                            <p className="text-sm text-muted-foreground truncate flex items-center gap-1.5">
                                                <span>{(prescription.medicationCount || 0)} item{(prescription.medicationCount || 0) !== 1 ? 's' : ''}</span>
                                                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                                <span>{prescription.doctorName || 'Medical Professional'}</span>
                                            </p>
                                        </div>
                                        <Button 
                                            variant="default" 
                                            size="sm" 
                                            className="action-btn shadow-sm" 
                                            onClick={() => {
                                                if (prescription.id) {
                                                    navigate(PATHS.PHARMACIST.PRESCRIPTION_DETAIL(prescription.id));
                                                }
                                            }}
                                        >
                                            Process
                                        </Button>
                                    </DashboardCard>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* Column 2: Stock Analysis (Synchronized Skeleton) */}
                <section className="flex flex-col h-full min-h-0 overflow-hidden">
                    <div className="flex items-center mb-4 h-8 shrink-0">
                        <h2 className="text-xl font-bold text-foreground">Stock Analysis</h2>
                    </div>
                    <DashboardCard className="flex-1 h-full flex flex-col justify-center p-6 overflow-hidden transition-all duration-300 hover:border-primary-500/50 hover:shadow-lg hover:-translate-y-1">
                        <PremiumPieChart
                            title="Stock Analysis"
                            data={INVENTORY_METRICS}
                            dataKey="value"
                            categoryKey="name"
                            noCard={true}
                            className="flex-1 w-full h-full min-h-0"
                        />
                    </DashboardCard>
                </section>

                {/* Column 3: Quick Actions (Synchronized Skeleton) */}
                <section className="flex flex-col h-full min-h-0 overflow-hidden">
                    <div className="flex items-center mb-4 h-8 shrink-0">
                        <h2 className="text-xl font-bold text-foreground">Quick Actions</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 grid-rows-2 gap-6 flex-1 h-full min-h-0">
                        {[
                            {
                                icon: Pill,
                                label: "Stock Check",
                                path: PATHS.PHARMACIST.INVENTORY,
                                color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
                                hoverBorder: "hover:border-emerald-500/50 dark:hover:border-emerald-500/80",
                                hoverShadow: "hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20",
                                hoverText: "group-hover:text-emerald-600"
                            },
                            {
                                icon: History,
                                label: "Admin Logs",
                                path: PATHS.ADMIN.SYSTEM_LOGS,
                                color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
                                hoverBorder: "hover:border-blue-500/50 dark:hover:border-blue-500/80",
                                hoverShadow: "hover:shadow-blue-500/10 dark:hover:shadow-blue-500/20",
                                hoverText: "group-hover:text-blue-600"
                            },
                        ].map((action, idx) => (
                            <DashboardCard
                                key={idx}
                                className={`flex flex-col items-center justify-center gap-2 p-3 cursor-pointer transition-all duration-300 group hover:-translate-y-1 hover:shadow-lg h-full w-full ${action.hoverBorder} ${action.hoverShadow}`}
                                onClick={() => navigate(action.path)}
                                noPadding
                            >
                                <div className={`p-3 rounded-full ${action.color} group-hover:scale-110 transition-transform duration-300 flex items-center justify-center`}>
                                    <action.icon className="h-6 w-6 text-current" />
                                </div>
                                <span className={`font-bold text-slate-700 dark:text-slate-200 text-[10px] uppercase tracking-widest transition-colors ${action.hoverText} text-center px-2`}>{action.label}</span>
                            </DashboardCard>
                        ))}
                    </div>
                </section>
            </TransitionItem>
        </div>
    );
};
