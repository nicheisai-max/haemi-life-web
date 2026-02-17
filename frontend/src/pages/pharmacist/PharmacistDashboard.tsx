import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
    Pill, Receipt, ClipboardList, CheckCircle2, AlertOctagon,
    QrCode, History, Package, Truck,
    Filter, RefreshCw
} from 'lucide-react';
import { GradientMesh } from '@/components/ui/GradientMesh';
import { Loader } from '@/components/ui/Loader';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { IconWrapper } from '@/components/ui/IconWrapper';
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

export const PharmacistDashboard: React.FC = () => {
    // const { user } = useAuth(); // Unused
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
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load prescriptions');
            console.error('Pharmacist dashboard error:', err);
        } finally {
            setLoading(false);
        }
    };

    const pendingOrders = prescriptions.filter(p => p.status === 'pending');
    const completedOrdersValue = prescriptions.filter(p => p.status === 'filled').length;

    return (
        <main className="w-full mx-auto p-4 md:p-8 max-w-[1920px] space-y-8">
            {/* Hero Section */}
            <TransitionItem className="relative overflow-hidden rounded-3xl border bg-teal-900 text-white shadow-xl">
                <GradientMesh variant="primary" className="opacity-40" />
                <div className="relative z-10 p-6 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-3 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-200 text-[11px] font-bold border border-teal-500/30 backdrop-blur-sm">
                            <Package className="h-3 w-3" aria-hidden="true" />
                            PHARMACY DISPENSARY
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
                            Dispensing Queue
                        </h1>
                        <p className="text-white/80 text-lg font-medium leading-relaxed">
                            {loading
                                ? <Loader size="xs" className="text-white inline-block align-middle" />
                                : `You have ${pendingOrders.length} prescriptions pending verification and dispensing.`
                            }
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full sm:w-auto">
                        <Button
                            size="lg"
                            className="bg-teal-500 hover:bg-teal-600 text-white shadow-lg h-12 text-sm font-bold rounded-xl gap-2 w-full sm:w-auto"
                            onClick={() => navigate('/prescriptions/dispense')}
                        >
                            <QrCode className="h-5 w-5" aria-hidden="true" />
                            Scan QR Code
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="bg-white/10 hover:bg-white/20 text-white border-white/20 shadow-lg h-12 text-sm font-bold rounded-xl gap-2 w-full sm:w-auto"
                            onClick={() => navigate('/inventory')}
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

            {/* Stats Grid */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6" aria-label="Key Metrics">
                <TransitionItem>
                    <DashboardCard className="flex items-center gap-5 hover:border-teal-500/50 transition-colors cursor-default">
                        <IconWrapper icon={Receipt} variant="primary" className="h-14 w-14" iconClassName="h-7 w-7" />
                        <div>
                            <div className="text-4xl font-bold tracking-tight text-foreground">
                                {loading ? <Loader size="xs" /> : pendingOrders.length}
                            </div>
                            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active Queue</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex items-center gap-5 hover:border-emerald-500/50 transition-colors cursor-default">
                        <IconWrapper icon={CheckCircle2} variant="success" className="h-14 w-14" iconClassName="h-7 w-7" />
                        <div>
                            <div className="text-4xl font-bold tracking-tight text-foreground">
                                {loading ? <Loader size="xs" /> : completedOrdersValue}
                            </div>
                            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dispensed Today</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex items-center gap-5 hover:border-amber-500/50 transition-colors cursor-default">
                        <IconWrapper icon={Truck} variant="warning" className="h-14 w-14" iconClassName="h-7 w-7" />
                        <div>
                            <div className="text-4xl font-bold tracking-tight text-foreground">
                                {loading ? <Loader size="xs" /> : "12"}
                            </div>
                            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Stock Arrivals</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>
            </section>

            {/* Main Content Split */}
            <TransitionItem className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
                {/* Left: Pending Scripts */}
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-foreground">Pending Prescriptions</h2>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Filter className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={fetchData}>
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-3 flex-1">
                        {loading ? (
                            <div className="flex justify-center p-12 h-full items-center">
                                <Loader />
                            </div>
                        ) : pendingOrders.length === 0 ? (
                            <DashboardCard className="text-center text-muted-foreground flex flex-col items-center justify-center h-[300px] border-dashed">
                                <CheckCircle2 className="h-12 w-12 opacity-20 mb-3" />
                                <p className="font-medium">All clear!</p>
                                <p className="text-sm opacity-75 mt-1">No pending prescriptions in the queue.</p>
                            </DashboardCard>
                        ) : (
                            pendingOrders.map((prescription) => (
                                <DashboardCard key={prescription.id} className="group p-4 flex items-center gap-4 transition-all hover:border-teal-500/50">
                                    <div className="bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 rounded-lg p-2 min-w-[60px] text-center shrink-0 border border-teal-100 dark:border-teal-900/50">
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
                                    <Button variant="default" size="sm" className="action-btn bg-teal-600 hover:bg-teal-700 shadow-sm" onClick={() => navigate(`/prescriptions/${prescription.id}`)}>
                                        Process
                                    </Button>
                                </DashboardCard>
                            ))
                        )}
                    </div>
                </div>

                {/* Right: Inventory & Actions */}
                <div className="space-y-8 flex flex-col h-full">
                    <section>
                        <h2 className="text-xl font-bold mb-4 text-foreground">Stock Analysis</h2>
                        <DashboardCard className="min-h-[300px] flex items-center justify-center p-6">
                            <PremiumPieChart
                                title="Inventory Distribution"
                                data={INVENTORY_METRICS}
                                dataKey="value"
                                categoryKey="name"
                                height={250}
                            />
                        </DashboardCard>
                    </section>

                    <section className="flex-1">
                        <h2 className="text-xl font-bold mb-4 text-foreground">Quick Actions</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <DashboardCard
                                className="flex flex-col items-center justify-center text-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all group h-28"
                                onClick={() => navigate('/inventory/check')}
                                noPadding
                            >
                                <IconWrapper icon={Pill} className="group-hover:scale-110 transition-transform" />
                                <span className="font-semibold text-foreground text-sm">Stock Check</span>
                            </DashboardCard>
                            <DashboardCard
                                className="flex flex-col items-center justify-center text-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all group h-28"
                                onClick={() => navigate('/history')}
                                noPadding
                            >
                                <IconWrapper icon={History} className="group-hover:scale-110 transition-transform" />
                                <span className="font-semibold text-foreground text-sm">Logs</span>
                            </DashboardCard>
                        </div>
                    </section>
                </div>
            </TransitionItem>
        </main>
    );
};
