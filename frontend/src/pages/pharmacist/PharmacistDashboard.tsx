import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { getPendingPrescriptions } from '../../services/prescription.service';
import type { Prescription } from '../../services/prescription.service';
import { QrCode, Receipt, CheckCircle2, AlertCircle, ClipboardCheck, Box, ShoppingCart, Truck, Pill, CheckCheck, ArrowRight, Zap, Database } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { GradientMesh } from '@/components/ui/GradientMesh';
import { Loader } from '@/components/ui/Loader';
import { useNavigate } from 'react-router-dom';
import { TransitionItem } from '../../components/layout/PageTransition';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { IconWrapper } from '@/components/ui/IconWrapper';

const MOCK_INVENTORY_DATA = [
    { name: 'Optimal', value: 45, color: 'hsl(var(--primary))' },
    { name: 'Low Stock', value: 15, color: '#f59e0b' },
    { name: 'Out of Stock', value: 5, color: '#ef4444' },
];

export const PharmacistDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const prescData = await getPendingPrescriptions();
            setPrescriptions(prescData);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load dashboard data');
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const pendingOrders = prescriptions.filter(p => p.status === 'pending');
    const todayFilled = prescriptions.filter(p => {
        if (p.status !== 'filled') return false;
        const updated = new Date(p.updated_at);
        const today = new Date();
        return updated.toDateString() === today.toDateString();
    }).length;

    return (
        <div className="w-full mx-auto p-4 md:p-8 max-w-[1920px] space-y-8">
            {/* Hero Section */}
            <TransitionItem className="relative overflow-hidden rounded-3xl border bg-slate-900 text-white shadow-xl">
                <GradientMesh variant="secondary" className="opacity-40" />
                <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                            <Zap className="h-3 w-3 fill-current" />
                            Inventory Health: Stable
                        </div>
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                            Hi, {user?.name}
                        </h1>
                        <p className="text-white/70 text-base font-medium leading-relaxed">
                            {loading
                                ? <Loader size="xs" className="inline-block align-middle" />
                                : `Operational readiness is at 98.4%. ${pendingOrders.length} vital prescriptions are awaiting your expert verification.`
                            }
                        </p>
                    </div>
                    <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg px-6 h-11 text-sm font-bold rounded-xl shrink-0 gap-2 group"
                    >
                        <QrCode className="h-5 w-5 group-hover:rotate-12 transition-transform" />
                        Smart Scan
                    </Button>
                </div>
            </TransitionItem>

            {/* Error Message */}
            {error && (
                <TransitionItem className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive flex items-center gap-3">
                    <AlertCircle className="h-5 w-5" />
                    <p className="text-sm font-medium">{error}</p>
                </TransitionItem>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <TransitionItem>
                    <DashboardCard className="flex items-center gap-4">
                        <IconWrapper icon={Receipt} variant="primary" />
                        <div>
                            <div className="text-3xl font-bold tracking-tight text-foreground">
                                {loading ? <Loader size="xs" /> : pendingOrders.length}
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">Active Prescriptions</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex items-center gap-4">
                        <IconWrapper icon={CheckCircle2} variant="success" />
                        <div>
                            <div className="text-3xl font-bold tracking-tight text-foreground">
                                {loading ? <Loader size="xs" /> : todayFilled}
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">Orders Fulfilled</div>
                            <div className="text-xs text-muted-foreground mt-1">Completion Rate: 98%</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex items-center gap-4">
                        <IconWrapper icon={Database} variant="neutral" />
                        <div>
                            <div className="text-3xl font-bold tracking-tight text-foreground">
                                {loading ? <Loader size="xs" /> : prescriptions.length}
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">Stock Analytics</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>
            </div>

            {/* Supply Chain Visualization */}
            <TransitionItem>
                <DashboardCard className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold tracking-tight">Warehouse Pulse</h2>
                            <p className="text-muted-foreground">Medication stock levels and availability metrics</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate('/pharmacist/inventory')}>
                            Manage Stock
                        </Button>
                    </div>

                    <div className="h-[250px] w-full mt-4 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--background))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '12px'
                                    }}
                                />
                                <Pie
                                    data={MOCK_INVENTORY_DATA}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={8}
                                    dataKey="value"
                                >
                                    {MOCK_INVENTORY_DATA.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                    ))}
                                </Pie>
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </DashboardCard>
            </TransitionItem>

            {/* Main Content Split */}
            <TransitionItem className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
                {/* Left: Quick Actions */}
                <div className="space-y-8">
                    <section>
                        <h2 className="text-xl font-semibold mb-4 text-foreground">Quick Actions</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <DashboardCard
                                className="flex flex-col items-center justify-center text-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                                onClick={() => navigate('/pharmacist/queue')}
                            >
                                <IconWrapper icon={ClipboardCheck} />
                                <span className="font-medium text-foreground">Validate</span>
                            </DashboardCard>
                            <DashboardCard
                                className="flex flex-col items-center justify-center text-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                                onClick={() => navigate('/pharmacist/inventory')}
                            >
                                <IconWrapper icon={Box} />
                                <span className="font-medium text-foreground">Inventory</span>
                            </DashboardCard>
                            <DashboardCard
                                className="flex flex-col items-center justify-center text-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                            >
                                <IconWrapper icon={ShoppingCart} />
                                <span className="font-medium text-foreground">New Sale</span>
                            </DashboardCard>
                            <DashboardCard
                                className="flex flex-col items-center justify-center text-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                            >
                                <IconWrapper icon={Truck} />
                                <span className="font-medium text-foreground">Orders</span>
                            </DashboardCard>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4 text-foreground">Operations Status</h2>
                        <DashboardCard className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white p-6 flex items-center justify-between shadow-lg border-none">
                            <div className="space-y-2">
                                <h3 className="text-lg font-bold">Pharmacy Overview</h3>
                                <div className="space-y-1 text-teal-50">
                                    <p className="flex items-center gap-2">
                                        <span className="font-bold text-white text-xl">{prescriptions.length}</span> total prescriptions
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <span className="font-bold text-white text-xl">{pendingOrders.length}</span> pending fulfillment
                                    </p>
                                </div>
                            </div>
                            <Pill className="h-16 w-16 opacity-20" />
                        </DashboardCard>
                    </section>
                </div>

                {/* Right: Pending Queue */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-foreground">Pending Queue</h2>
                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-primary" onClick={() => navigate('/prescriptions')}>
                            View All <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {loading ? (
                            <div className="flex justify-center p-8">
                                <Loader />
                            </div>
                        ) : pendingOrders.length === 0 ? (
                            <DashboardCard className="text-center text-muted-foreground flex flex-col items-center justify-center min-h-[200px]">
                                <CheckCheck className="h-12 w-12 opacity-20 mb-3" />
                                <p>All prescriptions processed</p>
                            </DashboardCard>
                        ) : (
                            pendingOrders.slice(0, 3).map((prescription) => (
                                <DashboardCard key={prescription.id} className="group p-4 flex items-center gap-4 transition-all hover:border-teal-500/50">
                                    <div className="bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 rounded-lg p-2 min-w-[60px] text-center shrink-0 border border-teal-100 dark:border-teal-900/50">
                                        <span className="block text-xs font-bold uppercase tracking-wider">New</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold truncate text-foreground">{prescription.patient_name || 'Patient'}</h3>
                                        <p className="text-sm text-muted-foreground truncate">
                                            {prescription.medication_count || 0} item{(prescription.medication_count || 0) !== 1 ? 's' : ''} • Dr. {prescription.doctor_name || 'N/A'}
                                        </p>
                                    </div>
                                    <Button variant="default" size="sm" className="action-btn bg-teal-600 hover:bg-teal-700" onClick={() => navigate(`/prescriptions/${prescription.id}`)}>
                                        Process
                                    </Button>
                                </DashboardCard>
                            ))
                        )}
                    </div>
                </div>
            </TransitionItem>
        </div>
    );
};
