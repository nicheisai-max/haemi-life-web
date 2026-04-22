import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MedicalLoader } from '@/components/ui/medical-loader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
    ClipboardList, CheckCircle2, AlertOctagon,
    QrCode, History, PackageOpen, AlertTriangle, ShieldCheck, ShoppingCart,
    User, Building2, CheckCircle, Pill, Filter, RefreshCw
} from 'lucide-react';
import { PATHS } from '../../routes/paths';
import { TransitionItem } from '../../components/layout/page-transition';
import {
    getPharmacistDashboardStats,
    getPharmacyOrders,
    approvePharmacyOrder
} from '../../services/pharmacist.service';
import { getAllPrescriptions } from '../../services/prescription.service';
import type { Prescription } from '../../services/prescription.service';
import type { OrderEntity, DashboardStats } from '../../types/pharmacist.types';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { GradientMesh } from '@/components/ui/gradient-mesh';
import { IconWrapper } from '@/components/ui/icon-wrapper';
import { PremiumPieChart } from '../../components/charts/premium-pie-chart';
import { PremiumLoader } from '@/components/ui/premium-loader';

const INVENTORY_METRICS = [
    { name: 'Antibiotics', value: 35, color: '#0E6B74' }, // Primary-800
    { name: 'Analgesics', value: 25, color: '#1BA7A6' }, // Primary-600
    { name: 'Chronics', value: 30, color: '#3FC2B5' },   // Primary-500
    { name: 'Topicals', value: 10, color: '#A7E6DB' },   // Primary-300
];

export const PharmacistDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [orders, setOrders] = useState<OrderEntity[]>([]);
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Tab State: Government vs Direct Orders
    const [activeTab, setActiveTab] = useState<'government' | 'direct'>('government');

    // Dispensing Workflow State
    const [selectedOrder, setSelectedOrder] = useState<OrderEntity | null>(null);
    const [dispensingStep, setDispensingStep] = useState<'confirm' | 'processing' | 'success'>('confirm');
    const [isGovDispense, setIsGovDispense] = useState(false);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [statsData, ordersData, prescriptionsData] = await Promise.all([
                getPharmacistDashboardStats(),
                getPharmacyOrders(),
                getAllPrescriptions()
            ]);
            setStats(statsData);
            setOrders(ordersData);
            setPrescriptions(prescriptionsData);
        } catch (err) {
            const apiError = err as { response?: { data?: { message?: string } } };
            setError(apiError.response?.data?.message || 'Failed to load dashboard data');
            console.error('Pharmacist dashboard error:', err);
        } finally {
            setLoading(false);
        }
    };

    const initiateDispense = (order: OrderEntity, isGov: boolean) => {
        setSelectedOrder(order);
        setIsGovDispense(isGov);
        setDispensingStep('confirm');
    };

    const handleDispenseAction = async () => {
        if (!selectedOrder) return;

        try {
            setDispensingStep('processing');

            // Artificial delay for premium institutional feel as requested
            await new Promise(resolve => setTimeout(resolve, 2000));

            await approvePharmacyOrder(selectedOrder.id);

            setDispensingStep('success');
            // Refresh stats in background
            fetchDashboardData();
        } catch (err) {
            console.error('Dispensing error:', err);
            toast.error('Dispensing failed. Please check network connectivity.');
            setDispensingStep('confirm');
        }
    };

    const closeDispenseModal = () => {
        setSelectedOrder(null);
        setDispensingStep('confirm');
    };

    const pendingOrders = orders.filter(o => o.status === 'Pending' && !o.is_government_subsidized);
    const govOrders = orders.filter(o => o.status === 'Pending' && o.is_government_subsidized);

    if (loading) {
        return <MedicalLoader message="Synchronizing Haemi Private Pharmacy Network..." />;
    }

    return (
        <div className="space-y-8">
            {/* Hero Section - Standardized Premium Style */}
            <TransitionItem className="relative overflow-hidden rounded-card bg-gradient-to-br from-teal-800 to-teal-950 text-white shadow-xl shadow-teal-900/20">
                <GradientMesh variant="primary" className="opacity-20" />
                <div className="relative z-10 p-6 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-3 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-100 text-[11px] font-bold border border-emerald-500/30 backdrop-blur-sm">
                            HAEMI DUAL-DISPENSING PANEL
                        </div>
                        <h1 className="page-heading !text-white !mb-0 transition-all duration-300">
                            Welcome, {user?.name || 'Pharmacist'}
                        </h1>
                        <p className="text-emerald-50/70 text-sm font-bold uppercase tracking-[0.2em] mb-1">Botswana Compliance Core</p>
                        <div className="page-subheading !text-white/80 !opacity-100 italic">
                            Manage Public (Government Subsidized) and Private (Direct) dispensing securely.
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full sm:w-auto">
                        <Button
                            size="lg"
                            variant="outline"
                            className="bg-white/10 text-white border-white/20 hover:bg-white hover:text-teal-900 shadow-lg h-12 text-sm font-bold rounded-card gap-2 group transition-all duration-300 hover:scale-105 active:scale-95"
                            onClick={() => navigate(PATHS.PHARMACIST.INVENTORY)}
                        >
                            <ClipboardList className="h-5 w-5" aria-hidden="true" />
                            Manage Inventory
                        </Button>
                        <Button
                            size="lg"
                            className="bg-white text-teal-900 hover:bg-teal-50 border border-transparent shadow-[0_0_20px_rgba(255,255,255,0.3)] h-12 text-sm font-bold rounded-card gap-2 group transition-all duration-300 hover:scale-105 active:scale-95"
                            onClick={() => navigate(PATHS.PHARMACIST.DISPENSE)}
                        >
                            <QrCode className="h-5 w-5" aria-hidden="true" />
                            Scan Prescription
                        </Button>
                    </div>
                </div>
            </TransitionItem>

            {error && (
                <TransitionItem className="rounded-card border border-destructive/50 bg-destructive/10 p-4 text-destructive flex items-center gap-3" role="alert">
                    <AlertOctagon className="h-5 w-5" aria-hidden="true" />
                    <p className="text-sm font-medium">{error}</p>
                </TransitionItem>
            )}

            {/* Stats Grid */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-6" aria-label="Key Metrics">
                <TransitionItem>
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:-translate-y-1 transition-all duration-300 text-center group" noPadding>
                        <IconWrapper icon={PackageOpen} variant="primary" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                {pendingOrders.length}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-primary transition-colors">Pending Orders</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:-translate-y-1 transition-all duration-300 text-center group" noPadding>
                        <IconWrapper icon={CheckCircle2} variant="success" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                {stats?.totalDispensedToday || 0}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">Dispensed Today</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:-translate-y-1 transition-all duration-300 text-center group border-amber-500/30" noPadding>
                        <IconWrapper icon={AlertTriangle} variant="warning" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-amber-600 dark:text-amber-400">
                                {stats?.lowStockCount || 0}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-amber-500 transition-colors">Low Stock Alerts</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:-translate-y-1 transition-all duration-300 text-center group border-destructive/30" noPadding>
                        <IconWrapper icon={History} variant="destructive" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-destructive">
                                {stats?.expiringSoonCount || 0}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-destructive transition-colors">Expiring Soon</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>
            </section>

            {/* Split Queue Hub */}
            <TransitionItem>
                <div className="bg-card border border-border/50 rounded-card p-2 inline-flex mb-6 w-full md:w-auto shadow-sm">
                    <button
                        className={cn(
                            'flex-1 md:flex-none px-6 py-2.5 rounded-card text-sm font-bold flex items-center justify-center gap-2 transition-all',
                            activeTab === 'government'
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'text-muted-foreground hover:bg-muted'
                        )}
                        onClick={() => setActiveTab('government')}
                    >
                        <ShieldCheck className="h-4 w-4" />
                        Government Subsidized Queue
                        {govOrders.length > 0 && (
                            <span className={cn(
                                'ml-2 px-2 py-0.5 rounded-full text-xs font-bold transition-all duration-200',
                                activeTab === 'government'
                                    ? 'bg-black/20 text-white'
                                    : 'bg-muted text-muted-foreground'
                            )}>
                                {govOrders.length}
                            </span>
                        )}
                    </button>
                    <button
                        className={cn(
                            'flex-1 md:flex-none px-6 py-2.5 rounded-card text-sm font-bold flex items-center justify-center gap-2 transition-all',
                            activeTab === 'direct'
                                ? 'bg-teal-600 text-white shadow-md'
                                : 'text-muted-foreground hover:bg-muted'
                        )}
                        onClick={() => setActiveTab('direct')}
                    >
                        <ShoppingCart className="h-4 w-4" />
                        Private / Direct Queue
                        {pendingOrders.length > 0 && (
                            <span className={cn(
                                'ml-2 px-2 py-0.5 rounded-full text-xs font-bold transition-all duration-200',
                                activeTab === 'direct'
                                    ? 'bg-black/20 text-white'
                                    : 'bg-muted text-muted-foreground'
                            )}>
                                {pendingOrders.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Government Tab */}
                {activeTab === 'government' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {govOrders.length === 0 ? (
                            <DashboardCard className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center border-dashed">
                                <CheckCircle2 className="h-16 w-16 opacity-20 mb-4" />
                                <p className="font-medium text-lg">Gov Queue is empty!</p>
                                <p className="opacity-75">All subsidized prescriptions are dispensed.</p>
                            </DashboardCard>
                        ) : (
                            <div className="grid gap-4">
                                {govOrders.map(order => (
                                    <DashboardCard key={order.id} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-l-4 border-l-primary">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="font-bold text-lg text-foreground">{order.patient_name || 'Anonymous Patient'}</h3>
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                                                    Gov. Subsidized
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Omang: <span className="font-mono font-bold">{order.omang_number || 'N/A'}</span> •
                                                Origin: <span className="font-medium text-foreground">{order.hospital_origin || 'Local Facility'}</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 w-full sm:w-auto">
                                            <Button
                                                onClick={() => initiateDispense(order, true)}
                                                className="rounded-card bg-slate-900 hover:bg-slate-800 text-white shadow-lg flex-1 sm:flex-none gap-2 h-11 px-6 font-bold"
                                            >
                                                <ShieldCheck className="h-4 w-4" />
                                                Verify Omang & Dispense
                                            </Button>
                                        </div>
                                    </DashboardCard>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Direct/Private Tab */}
                {activeTab === 'direct' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {pendingOrders.length === 0 ? (
                            <DashboardCard className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center border-dashed">
                                <CheckCircle2 className="h-16 w-16 opacity-20 mb-4" />
                                <p className="font-medium text-lg">Direct Queue is empty!</p>
                                <p className="opacity-75">No private orders are currently pending approval.</p>
                            </DashboardCard>
                        ) : (
                            <div className="grid gap-4">
                                {pendingOrders.map(order => (
                                    <DashboardCard key={order.id} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-l-4 border-l-teal-500">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="font-bold text-lg text-foreground">{order.patient_name || 'Walk-in Patient'}</h3>
                                                <Badge variant="outline" className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20 text-[10px] font-bold uppercase tracking-wider">
                                                    {order.delivery_mode}
                                                </Badge>
                                                {order.is_prescription_required && (
                                                    <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px] font-bold uppercase tracking-wider">
                                                        Rx Required
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">Order ID: {order.id.split('-')[0]} • Commercial Stock Total: P{Number(order.total_amount).toFixed(2)}</p>
                                        </div>
                                        <div className="flex items-center gap-3 w-full sm:w-auto">
                                            <Button
                                                onClick={() => initiateDispense(order, false)}
                                                className="rounded-card bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20 flex-1 sm:flex-none gap-2 h-11 px-6 font-bold"
                                            >
                                                <ShoppingCart className="h-4 w-4" />
                                                Approve & Dispatch
                                            </Button>
                                        </div>
                                    </DashboardCard>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </TransitionItem>

            {/* Main Content Hub - Institutional Compaction Certification (Legacy Restoration) */}
            <TransitionItem className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.2fr_1fr_0.8fr] gap-8 items-stretch h-[42vh] min-h-[350px]">
                {/* Column 1: Pending Prescriptions (Synchronized Skeleton) */}
                <section className="flex flex-col h-full min-h-0 overflow-hidden group/col">
                    <div className="flex items-center justify-between mb-4 h-8 shrink-0">
                        <h2 className="text-xl font-bold text-foreground">Pending Prescriptions</h2>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Filter prescriptions">
                                <Filter className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={fetchDashboardData} aria-label="Refresh list">
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 h-full overflow-y-auto pr-2 pb-0 scrollbar-thin scrollbar-thumb-border/50">
                        {loading ? (
                            <div className="flex justify-center p-12 h-full items-center">
                                <PremiumLoader size="md" />
                            </div>
                        ) : prescriptions.length === 0 ? (
                            <DashboardCard className="text-center text-muted-foreground flex flex-col items-center justify-center border-dashed h-full transition-all duration-300 hover:border-primary-500/50 hover:shadow-lg hover:-translate-y-1">
                                <CheckCircle2 className="h-12 w-12 opacity-20 mb-3" />
                                <p className="font-medium text-sm">All clear!</p>
                                <p className="text-[12px] opacity-75 mt-1">No pending prescriptions in the queue.</p>
                            </DashboardCard>
                        ) : (
                            <div className="space-y-3 pb-4">
                                {prescriptions.map((prescription) => (
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
                                                    navigate(PATHS.PHARMACIST.PRESCRIPTION_DETAIL(prescription.id.toString()));
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

            {/* --- INSTITUTIONAL DISPENSING WORKFLOW MODAL --- */}
            <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && closeDispenseModal()}>
                <DialogContent className="sm:max-w-[31.25rem] p-0 overflow-hidden rounded-[var(--card-radius)] border-none shadow-2xl">
                    <AnimatePresence mode="wait">
                        {dispensingStep === 'confirm' && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex flex-col"
                            >
                                <DialogHeader className="p-8 bg-slate-50 dark:bg-slate-900/50 border-b">
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                                        {isGovDispense ? <ShieldCheck className="h-6 w-6" /> : <ShoppingCart className="h-6 w-6" />}
                                    </div>
                                    <DialogTitle className="text-2xl font-bold text-foreground">
                                        {isGovDispense ? 'Confirm Government Dispensing' : 'Confirm Order Approval'}
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground pt-1">
                                        Review the patient details and stock allocation before final dispensing.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="p-8 space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[0.625rem] font-bold uppercase tracking-widest text-slate-400">Patient</p>
                                            <div className="flex items-center gap-2">
                                                <User className="h-3.5 w-3.5 text-primary" />
                                                <p className="font-bold text-foreground">{selectedOrder?.patient_name}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <p className="text-[0.625rem] font-bold uppercase tracking-widest text-slate-400">Identifier</p>
                                            <p className="font-mono text-sm font-bold text-foreground">{isGovDispense ? selectedOrder?.omang_number : `ID: ${selectedOrder?.id.split('-')[0]}`}</p>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                        <div className="flex items-start gap-4">
                                            <div className="shrink-0 w-8 h-8 rounded-lg bg-background flex items-center justify-center border shadow-sm">
                                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[0.75rem] font-bold text-foreground mb-0.5">Allocation Source</p>
                                                <p className="text-[0.75rem] text-muted-foreground">
                                                    {isGovDispense ? `Government Subsidized (Origin: ${selectedOrder?.hospital_origin})` : 'Private Commercial Inventory'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <DialogFooter className="p-8 bg-slate-50 dark:bg-slate-900/20 border-t flex-col sm:flex-row gap-3">
                                    <Button variant="ghost" onClick={closeDispenseModal} className="w-full sm:w-auto font-bold h-12">
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleDispenseAction}
                                        className={`w-full sm:w-auto h-12 px-8 font-bold shadow-lg ${isGovDispense ? 'bg-slate-900' : 'bg-teal-600'} text-white`}
                                    >
                                        {isGovDispense ? 'Verify & Dispense' : 'Approve & Dispatch'}
                                    </Button>
                                </DialogFooter>
                            </motion.div>
                        )}

                        {dispensingStep === 'processing' && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="p-16 flex flex-col items-center justify-center text-center min-h-[25rem]"
                            >
                                <MedicalLoader variant="viewport" message={isGovDispense ? "Synchronizing with National Health Database..." : "Allocating Private Inventory Stock..."} />
                                <p className="text-sm text-muted-foreground mt-4 italic">Please wait, performing secure institutional transaction...</p>
                            </motion.div>
                        )}

                        {dispensingStep === 'success' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="p-12 flex flex-col items-center justify-center text-center min-h-[25rem]"
                            >
                                <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-8 border border-emerald-500/20 shadow-[0_0_2.5rem_rgba(16,185,129,0.2)]">
                                    <CheckCircle className="h-10 w-10" />
                                </div>
                                <h2 className="text-2xl font-bold text-foreground mb-3">Dispensed Successfully!</h2>
                                <p className="text-muted-foreground max-w-[18.75rem] mb-8">
                                    The medication has been allocated and the patient record updated in real-time.
                                </p>
                                <Button
                                    onClick={closeDispenseModal}
                                    variant="outline"
                                    className="h-12 px-12 rounded-full font-bold border-primary/20 text-primary hover:bg-primary/5"
                                >
                                    Dismiss
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </DialogContent>
            </Dialog>
        </div>
    );
};
