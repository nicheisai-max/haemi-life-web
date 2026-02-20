import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import {
    Pill, Receipt, ClipboardList, CheckCircle2, AlertOctagon,
    QrCode, History, Truck,
    Filter, RefreshCw
} from 'lucide-react';
import { GradientMesh } from '@/components/ui/GradientMesh';
import { PremiumLoader } from '@/components/ui/PremiumLoader';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { IconWrapper } from '@/components/ui/IconWrapper';
import { PATHS } from '../../routes/paths';
import { TransitionItem } from '../../components/layout/PageTransition';
import { PremiumPieChart } from '../../components/charts/PremiumPieChart';
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

    return (
        <div className="space-y-8">
            {/* Hero Section - Standardized Premium Style */}
            <TransitionItem className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-800 to-teal-950 text-white shadow-xl shadow-teal-900/20">
                <GradientMesh variant="primary" className="opacity-20" />
                <div className="relative z-10 p-6 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-3 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-100 text-[11px] font-bold border border-emerald-500/30 backdrop-blur-sm">
                            PHARMACY DISPENSARY
                        </div>
                        <h1 className="page-heading !text-white !mb-0 transition-all duration-300">
                            Welcome, {user?.name?.split(' ')[0]}
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
                            className="bg-white dark:bg-primary text-teal-900 dark:text-teal-950 hover:bg-teal-50 dark:hover:bg-primary/90 shadow-[0_0_20px_rgba(255,255,255,0.3)] dark:shadow-[0_0_20_rgba(63,194,181,0.3)] h-12 text-sm font-bold rounded-xl gap-2 w-full sm:w-auto transition-all duration-300 hover:scale-105 active:scale-95 border-none"
                            onClick={() => navigate(PATHS.PHARMACIST.DISPENSE)}
                        >
                            <QrCode className="h-5 w-5" aria-hidden="true" />
                            Scan QR Code
                        </Button>
                        <Button
                            size="lg"
                            className="bg-white/10 hover:bg-white/20 text-white border-none shadow-lg h-12 text-sm font-bold rounded-xl gap-2 w-full sm:w-auto transition-all duration-300 backdrop-blur-md"
                            onClick={() => navigate(PATHS.PHARMACIST.INVENTORY)}
                        >
                            <ClipboardList className="h-5 w-5" aria-hidden="true" />
                            Inventory
                        </Button>
                    </div>
                </div>
            </TransitionItem>

            {/* Error Message */}
            {error && (
                <TransitionItem className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-destructive flex items-center gap-3" role="alert">
                    <AlertOctagon className="h-5 w-5" aria-hidden="true" />
                    <p className="text-sm font-medium">{error}</p>
                </TransitionItem>
            )}

            <section className="grid grid-cols-2 md:grid-cols-3 gap-6" aria-label="Key Metrics">
                <TransitionItem>
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-primary-500/50 dark:hover:border-primary-500/80 hover:shadow-lg hover:shadow-primary-500/10 dark:hover:shadow-primary-500/20 hover:-translate-y-1 transition-all duration-300 text-center group cursor-default" noPadding>
                        <IconWrapper icon={Receipt} variant="primary" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-foreground">
                                {loading ? <PremiumLoader size="sm" className="justify-start" /> : pendingOrders.length}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest">Active Queue</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-emerald-500/50 transition-all duration-300 group cursor-default text-center" noPadding>
                        <IconWrapper icon={CheckCircle2} variant="success" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-foreground">
                                {loading ? <PremiumLoader size="sm" className="justify-start" /> : completedOrdersValue}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest">Dispensed Today</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem className="col-span-2 md:col-span-1">
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-amber-500/50 transition-all duration-300 group cursor-default text-center" noPadding>
                        <IconWrapper icon={Truck} variant="warning" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-foreground">
                                {loading ? <PremiumLoader size="sm" className="justify-start" /> : "12"}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest">Stock Arrivals</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>
            </section>

            {/* Main Content Split */}
            <TransitionItem className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8 items-start">
                {/* Left: Pending Scripts */}
                <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-4">
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

                    <div className="space-y-3 flex-1">
                        {loading ? (
                            <div className="flex justify-center p-12 h-full items-center">
                                <PremiumLoader size="md" />
                            </div>
                        ) : pendingOrders.length === 0 ? (
                            <DashboardCard className="text-center text-muted-foreground flex flex-col items-center justify-center h-[300px] border-dashed">
                                <CheckCircle2 className="h-12 w-12 opacity-20 mb-3" />
                                <p className="font-medium">All clear!</p>
                                <p className="text-sm opacity-75 mt-1">No pending prescriptions in the queue.</p>
                            </DashboardCard>
                        ) : (
                            pendingOrders.map((prescription) => (
                                <DashboardCard key={prescription.id} className="group p-4 flex items-center gap-4 transition-all hover:border-primary-500/50">
                                    <div className="bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-lg p-2 w-16 text-center shrink-0 border border-primary-100 dark:border-primary-900/50">
                                        <span className="block text-xs font-bold uppercase tracking-wider">New</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold truncate text-foreground">{prescription.patient_name || 'Patient'}</h3>
                                        <p className="text-sm text-muted-foreground truncate flex items-center gap-1.5">
                                            <span>{prescription.medication_count || 0} item{(prescription.medication_count || 0) !== 1 ? 's' : ''}</span>
                                            <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                            <span>Dr. {prescription.doctor_name || 'N/A'}</span>
                                        </p>
                                    </div>
                                    <Button variant="default" size="sm" className="action-btn shadow-sm" onClick={() => navigate(PATHS.PHARMACIST.PRESCRIPTION_DETAIL(prescription.id))}>
                                        Process
                                    </Button>
                                </DashboardCard>
                            ))
                        )}
                    </div>
                </div>

                {/* Right: Inventory & Actions */}
                <div className="space-y-8 flex flex-col">
                    <section>
                        <PremiumPieChart
                            title="Stock Analysis"
                            data={INVENTORY_METRICS}
                            dataKey="value"
                            categoryKey="name"
                            height={250}
                        />
                    </section>

                    <section className="flex-1">
                        <h2 className="text-xl font-bold mb-4 text-foreground">Quick Actions</h2>
                        <div className="grid grid-cols-2 gap-6">
                            {[
                                {
                                    icon: Pill,
                                    label: "Stock Check",
                                    path: PATHS.PHARMACIST.INVENTORY,
                                    sub: "Inventory Check",
                                    color: "text-primary-600 bg-primary-50 dark:bg-primary-900/40 dark:text-primary-300",
                                    hoverBorder: "hover:border-primary-500/50 dark:hover:border-primary-400/80",
                                    hoverShadow: "hover:shadow-primary-500/10 dark:hover:shadow-primary-500/20",
                                    hoverText: "group-hover:text-primary-600 dark:group-hover:text-primary-200"
                                },
                                {
                                    icon: History,
                                    label: "Admin Logs",
                                    path: PATHS.ADMIN.SYSTEM_LOGS,
                                    sub: "Activity History",
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
                                        <action.icon className="h-6 w-6" />
                                    </div>
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className={`font-semibold text-slate-700 dark:text-slate-200 text-sm transition-colors ${action.hoverText}`}>{action.label}</span>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">{action.sub}</span>
                                    </div>
                                </DashboardCard>
                            ))}
                        </div>
                    </section>
                </div>
            </TransitionItem>
        </div>
    );
};
