import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getPendingPrescriptions } from '../../services/prescription.service';
import type { Prescription } from '../../services/prescription.service';
import { QrCode, Receipt, CheckCircle2, AlertCircle, ClipboardCheck, Box, ShoppingCart, Truck, Pill, CheckCheck, ArrowRight, Zap, Database } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { GradientMesh } from '@/components/ui/GradientMesh';
import { GlassCard } from '@/components/ui/GlassCard';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const MOCK_INVENTORY_DATA = [
    { name: 'Optimal', value: 45, color: 'hsl(var(--primary))' },
    { name: 'Low Stock', value: 15, color: '#f59e0b' },
    { name: 'Out of Stock', value: 5, color: '#ef4444' },
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { type: 'spring' as const, stiffness: 100 }
    }
};

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

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const pendingOrders = prescriptions.filter(p => p.status === 'pending');
    const todayFilled = prescriptions.filter(p => {
        if (p.status !== 'filled') return false;
        const updated = new Date(p.updated_at);
        const today = new Date();
        return updated.toDateString() === today.toDateString();
    }).length;

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="container mx-auto p-4 md:p-8 max-w-[1200px] space-y-8"
        >
            {/* Hero Section */}
            <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl border bg-slate-900 text-white shadow-2xl">
                <GradientMesh variant="secondary" className="opacity-40" />
                <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                    <div className="space-y-4 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-bold border border-emerald-500/30">
                            <Zap className="h-4 w-4 fill-current" />
                            Inventory Health: Stable
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                            {getGreeting()}, {user?.name}
                        </h1>
                        <p className="text-white/70 text-lg md:text-xl font-medium leading-relaxed">
                            {loading
                                ? 'Syncing pharmaceutical logistics...'
                                : `Operational readiness is at 98.4%. ${pendingOrders.length} vital prescriptions are awaiting your expert verification.`
                            }
                        </p>
                    </div>
                    <Button
                        size="lg"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl px-8 h-14 text-lg font-bold rounded-2xl shrink-0 gap-3 group"
                    >
                        <QrCode className="h-6 w-6 group-hover:rotate-12 transition-transform" />
                        Smart Scan
                    </Button>
                </div>
            </motion.div>

            {/* Error Message */}
            {error && (
                <motion.div variants={itemVariants} className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive flex items-center gap-3">
                    <AlertCircle className="h-5 w-5" />
                    <p className="text-sm font-medium">{error}</p>
                </motion.div>
            )}

            {/* Stats Grid */}
            <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div variants={itemVariants}>
                    <GlassCard className="p-8 flex items-center gap-6" mesh meshVariant="secondary">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-500 shadow-inner">
                            <Receipt className="h-8 w-8" />
                        </div>
                        <div>
                            <div className="text-4xl font-black tracking-tight">{loading ? '...' : pendingOrders.length}</div>
                            <div className="text-sm font-bold uppercase tracking-widest text-emerald-500/80 tracking-tight">Active Prescriptions</div>
                        </div>
                    </GlassCard>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <GlassCard className="p-8 flex items-center gap-6" mesh meshVariant="primary">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-500 shadow-inner">
                            <CheckCircle2 className="h-8 w-8" />
                        </div>
                        <div>
                            <div className="text-4xl font-black tracking-tight">{loading ? '...' : todayFilled}</div>
                            <div className="text-sm font-bold uppercase tracking-widest text-blue-500/80 tracking-tight">Orders Fulfilled</div>
                        </div>
                    </GlassCard>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <GlassCard className="p-8 flex items-center gap-6" mesh meshVariant="accent">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-500 shadow-inner">
                            <Database className="h-8 w-8" />
                        </div>
                        <div>
                            <div className="text-4xl font-black tracking-tight">{loading ? '...' : prescriptions.length}</div>
                            <div className="text-sm font-bold uppercase tracking-widest text-orange-500/80 tracking-tight">Stock Analytics</div>
                        </div>
                    </GlassCard>
                </motion.div>
            </motion.div>

            {/* Supply Chain Visualization */}
            <motion.div variants={itemVariants}>
                <GlassCard className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold tracking-tight">Warehouse Pulse</h2>
                            <p className="text-muted-foreground">Medication stock levels and availability metrics</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => navigate('/inventory')}>
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
                </GlassCard>
            </motion.div>

            {/* Main Content Split */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
                {/* Left: Quick Actions */}
                <div className="space-y-8">
                    <section>
                        <h2 className="text-xl font-semibold mb-4 text-foreground">Quick Actions</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="p-6 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all hover:border-primary hover:bg-muted/50 group" onClick={() => navigate('/prescriptions')}>
                                <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                    <ClipboardCheck className="h-6 w-6" />
                                </div>
                                <span className="font-medium">Validate</span>
                            </Card>
                            <Card className="p-6 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all hover:border-primary hover:bg-muted/50 group" onClick={() => navigate('/inventory')}>
                                <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                    <Box className="h-6 w-6" />
                                </div>
                                <span className="font-medium">Inventory</span>
                            </Card>
                            <Card className="p-6 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all hover:border-primary hover:bg-muted/50 group">
                                <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                    <ShoppingCart className="h-6 w-6" />
                                </div>
                                <span className="font-medium">New Sale</span>
                            </Card>
                            <Card className="p-6 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all hover:border-primary hover:bg-muted/50 group">
                                <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                    <Truck className="h-6 w-6" />
                                </div>
                                <span className="font-medium">Orders</span>
                            </Card>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4 text-foreground">Operations Status</h2>
                        <Card className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white p-6 flex items-center justify-between shadow-lg">
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
                        </Card>
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
                            <Card className="p-8 text-center text-muted-foreground">
                                Loading queue...
                            </Card>
                        ) : pendingOrders.length === 0 ? (
                            <Card className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[200px]">
                                <CheckCheck className="h-12 w-12 opacity-20 mb-3" />
                                <p>All prescriptions processed</p>
                            </Card>
                        ) : (
                            pendingOrders.slice(0, 3).map((prescription) => (
                                <Card key={prescription.id} className="group p-4 flex items-center gap-4 transition-all hover:shadow-md hover:border-teal-500/50">
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
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};
