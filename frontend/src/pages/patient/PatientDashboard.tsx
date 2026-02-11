import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getMyAppointments } from '../../services/appointment.service';
import { getMyPrescriptions } from '../../services/prescription.service';
import type { Appointment } from '../../services/appointment.service';
import type { Prescription } from '../../services/prescription.service';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Calendar, FileText, FolderOpen, AlertCircle, ThermometerSun, Search, History, Settings as SettingsIcon, CalendarX, Clock, ArrowRight, Activity, Heart } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GradientMesh } from '@/components/ui/GradientMesh';
import { GlassCard } from '@/components/ui/GlassCard';
import { motion } from 'framer-motion';

const MOCK_HEALTH_DATA = [
    { name: 'Week 1', score: 65 },
    { name: 'Week 2', score: 72 },
    { name: 'Week 3', score: 68 },
    { name: 'Week 4', score: 85 },
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

export const PatientDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [apptData, prescData] = await Promise.all([
                getMyAppointments({ upcoming: true }),
                getMyPrescriptions()
            ]);
            setAppointments(apptData);
            setPrescriptions(prescData);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load dashboard data');
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return {
            day: date.getDate().toString(),
            month: date.toLocaleDateString('en-US', { month: 'short' })
        };
    };

    const formatTime = (timeStr: string) => {
        return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const upcomingAppointments = appointments.filter(a => a.status === 'scheduled').slice(0, 3);
    const activePrescriptions = prescriptions.filter(p => p.status === 'pending' || p.status === 'filled');

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="container mx-auto p-4 md:p-8 max-w-[1200px] space-y-8"
        >
            {/* Hero Section */}
            <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl border bg-slate-900 text-white shadow-2xl">
                <GradientMesh variant="primary" className="opacity-40" />
                <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                    <div className="space-y-4 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 text-primary-foreground text-sm font-bold border border-primary/30">
                            <Heart className="h-4 w-4 fill-current" />
                            Premium Care Status: Active
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                            {getGreeting()}, {user?.name}
                        </h1>
                        <p className="text-white/70 text-lg md:text-xl font-medium leading-relaxed">
                            {loading
                                ? 'Personalizing your health profile...'
                                : `Your health mission is on track. You have ${upcomingAppointments.length} upcoming consultations to optimize your well-being.`
                            }
                        </p>
                    </div>
                    <Button
                        size="lg"
                        className="bg-primary hover:bg-primary/90 text-white shadow-xl px-8 h-14 text-lg font-bold rounded-2xl shrink-0 gap-3 group"
                        onClick={() => navigate('/appointments/book')}
                    >
                        <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform" />
                        Book Appointment
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
                    <GlassCard className="p-8 flex items-center gap-6" mesh meshVariant="primary">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-500 shadow-inner">
                            <Calendar className="h-8 w-8" />
                        </div>
                        <div>
                            <div className="text-4xl font-black tracking-tight">{loading ? '...' : upcomingAppointments.length}</div>
                            <div className="text-sm font-bold uppercase tracking-widest text-blue-500/80 tracking-tight">Active Bookings</div>
                        </div>
                    </GlassCard>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <GlassCard className="p-8 flex items-center gap-6" mesh meshVariant="secondary">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-500 shadow-inner">
                            <FileText className="h-8 w-8" />
                        </div>
                        <div>
                            <div className="text-4xl font-black tracking-tight">{loading ? '...' : activePrescriptions.length}</div>
                            <div className="text-sm font-bold uppercase tracking-widest text-emerald-500/80 tracking-tight">Active Scripts</div>
                        </div>
                    </GlassCard>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <GlassCard className="p-8 flex items-center gap-6" mesh meshVariant="accent">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-500 shadow-inner">
                            <FolderOpen className="h-8 w-8" />
                        </div>
                        <div>
                            <div className="text-4xl font-black tracking-tight">{loading ? '...' : appointments.length}</div>
                            <div className="text-sm font-bold uppercase tracking-widest text-purple-500/80 tracking-tight">Lifetime Visits</div>
                        </div>
                    </GlassCard>
                </motion.div>
            </motion.div>

            {/* Health Pulse Visualization */}
            <motion.div variants={itemVariants}>
                <GlassCard className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold tracking-tight">Your Health Pulse</h2>
                            <p className="text-muted-foreground">Wellness score and activity trends over the last month</p>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-xl text-primary font-bold text-sm">
                            <Activity className="h-4 w-4" />
                            Top 5% Active
                        </div>
                    </div>

                    <div className="h-[250px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={MOCK_HEALTH_DATA}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.1} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }}
                                />
                                <YAxis
                                    hide
                                    domain={['dataMin - 10', 'dataMax + 10']}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--background))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '12px'
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="score"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={4}
                                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 6, stroke: 'hsl(var(--background))' }}
                                    activeDot={{ r: 8, strokeWidth: 0 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </GlassCard>
            </motion.div>

            {/* Main Content Split */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
                {/* Left: Quick Actions & Tips */}
                <div className="space-y-8">
                    <section>
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            Quick Actions
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="p-6 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all hover:border-primary hover:bg-muted/50 group" onClick={() => navigate('/prescriptions')}>
                                <ThermometerSun className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
                                <span className="font-medium">Order Medicine</span>
                            </Card>
                            <Card className="p-6 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all hover:border-primary hover:bg-muted/50 group" onClick={() => navigate('/doctors')}>
                                <Search className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
                                <span className="font-medium">Find Doctor</span>
                            </Card>
                            <Card className="p-6 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all hover:border-primary hover:bg-muted/50 group" onClick={() => navigate('/medical-records')}>
                                <History className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
                                <span className="font-medium">View History</span>
                            </Card>
                            <Card className="p-6 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all hover:border-primary hover:bg-muted/50 group" onClick={() => navigate('/settings')}>
                                <SettingsIcon className="h-8 w-8 text-primary group-hover:rotate-90 transition-transform" />
                                <span className="font-medium">Settings</span>
                            </Card>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4">Health Tips</h2>
                        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6 flex items-center justify-between shadow-lg overflow-hidden relative">
                            <GradientMesh variant="subtle" className="opacity-20" />
                            <div className="space-y-2 max-w-[80%] relative z-10">
                                <h3 className="text-lg font-bold">Stay Hydrated</h3>
                                <p className="text-primary-foreground/90 leading-relaxed">
                                    Drinking enough water is crucial for regulating body temperature and maintaining organ function.
                                </p>
                            </div>
                            <ThermometerSun className="h-12 w-12 opacity-20 relative z-10" />
                        </Card>
                    </section>
                </div>

                {/* Right: Upcoming Appointments */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Appointments</h2>
                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-primary" onClick={() => navigate('/appointments')}>
                            View All <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {loading ? (
                            <>
                                <Card className="p-4 flex items-center gap-4">
                                    <Skeleton className="h-14 w-14 rounded-lg shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-[60%]" />
                                        <Skeleton className="h-3 w-[40%]" />
                                    </div>
                                    <Skeleton className="h-9 w-16" />
                                </Card>
                                <Card className="p-4 flex items-center gap-4">
                                    <Skeleton className="h-14 w-14 rounded-lg shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-[60%]" />
                                        <Skeleton className="h-3 w-[40%]" />
                                    </div>
                                    <Skeleton className="h-9 w-16" />
                                </Card>
                            </>
                        ) : upcomingAppointments.length === 0 ? (
                            <Card className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[200px]">
                                <CalendarX className="h-12 w-12 opacity-20 mb-3" />
                                <p>No upcoming appointments</p>
                                <Button variant="link" className="mt-2 text-primary" onClick={() => navigate('/appointments/book')}>Book now</Button>
                            </Card>
                        ) : (
                            upcomingAppointments.map((appointment) => {
                                const dateInfo = formatDate(appointment.appointment_date);
                                return (
                                    <Card key={appointment.id} className="p-4 flex items-center gap-4 transition-all hover:shadow-md hover:border-primary/50 group">
                                        <div className="bg-muted rounded-lg p-2 min-w-[60px] text-center shrink-0 border group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                                            <span className="block text-xl font-bold leading-none">{dateInfo.day}</span>
                                            <span className="block text-xs font-bold text-muted-foreground uppercase mt-0.5">{dateInfo.month}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold truncate">{appointment.other_party_name || 'Doctor'}</h3>
                                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                                <span className="truncate max-w-[120px]">{appointment.reason}</span>
                                                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <Clock className="h-3 w-3" />
                                                    {formatTime(appointment.appointment_time)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="shadow-md"
                                                onClick={() => navigate(`/consultation/${appointment.id}`)}
                                            >
                                                Join
                                            </Button>
                                        </div>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};
