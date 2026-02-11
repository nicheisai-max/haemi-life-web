import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getMyAppointments } from '../../services/appointment.service';
import { getDoctorPatients } from '../../services/doctor.service';
import type { Appointment } from '../../services/appointment.service';
import {
    CalendarCheck, Users, ClipboardCheck, Contact, AlertCircle,
    UserPlus, ClipboardList, Pill, BarChart3, Calendar as CalendarIcon,
    ArrowRight, Play, CalendarX, TrendingUp, BrainCircuit, Activity, Zap
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GradientMesh } from '@/components/ui/GradientMesh';
import { GlassCard } from '@/components/ui/GlassCard';
import { motion } from 'framer-motion';
import { ClinicalCopilot } from '@/components/ui/ClinicalCopilot';
import { PredictiveInsights } from '@/components/ui/PredictiveInsights';
import { AnimatedEmptyState } from '@/components/ui/AnimatedEmptyState';

const MOCK_VOLUME_DATA = [
    { name: '08:00', patients: 2 },
    { name: '10:00', patients: 5 },
    { name: '12:00', patients: 3 },
    { name: '14:00', patients: 8 },
    { name: '16:00', patients: 4 },
    { name: '18:00', patients: 2 },
];

const MOCK_DOCTOR_INSIGHTS = [
    {
        label: 'Patient Retention',
        value: '94%',
        description: 'Your patient return rate is 12% higher than the regional average for Gaborone.',
        trend: 'up' as const,
        trendValue: '+2.4%',
        icon: Users,
        variant: 'primary' as const
    },
    {
        label: 'Clinical Efficiency',
        value: '18m',
        description: 'Average consultation time has decreased, allowing for 2 additional daily slots.',
        trend: 'down' as const,
        trendValue: '-15%',
        icon: Activity,
        variant: 'accent' as const
    },
    {
        label: 'Diagnosis Sync',
        value: '99.2%',
        description: 'Auto-sync with national health registry is operating at peak performance.',
        trend: 'neutral' as const,
        trendValue: '0%',
        icon: Zap,
        variant: 'secondary' as const
    }
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

import { useLanguage } from '../../context/LanguageContext';

export const DoctorDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [patientCount, setPatientCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCopilotOpen, setIsCopilotOpen] = useState(false);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const [apptData, patientsData] = await Promise.all([
                getMyAppointments({ upcoming: true }),
                getDoctorPatients().catch(() => [])
            ]);
            setAppointments(apptData);
            setPatientCount(patientsData.length);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load dashboard data');
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
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
        if (hour < 12) return t('hero.greeting_morning');
        if (hour < 18) return t('hero.greeting_afternoon');
        return t('hero.greeting_evening');
    };

    const todayAppointments = appointments.filter(a => {
        const apptDate = new Date(a.appointment_date);
        const today = new Date();
        return apptDate.toDateString() === today.toDateString() && a.status === 'scheduled';
    }).slice(0, 3);

    const pendingReviews = appointments.filter(a => a.status === 'completed').length;

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="container mx-auto p-4 md:p-8 max-w-[1200px] space-y-12 relative overflow-x-hidden"
        >
            <ClinicalCopilot isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />

            {/* Hero Section */}
            <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl border bg-slate-900 text-white shadow-2xl">
                <GradientMesh variant="secondary" className="opacity-40" />
                <div className="relative z-10 p-6 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                    <div className="space-y-4 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/20 text-teal-400 text-sm font-bold border border-teal-500/30">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                            </span>
                            Shift: On-Duty
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                            {getGreeting()}, Dr. {user?.name}
                        </h1>
                        <p className="text-white/70 text-lg md:text-xl font-medium leading-relaxed">
                            {loading
                                ? t('common.loading')
                                : t('hero.subtitle_doctor').replace('{count}', todayAppointments.length.toString())
                            }
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 shrink-0">
                        <Button
                            size="lg"
                            variant="outline"
                            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/30 shadow-xl px-8 h-14 text-lg font-bold rounded-2xl gap-3 group"
                            onClick={() => setIsCopilotOpen(true)}
                        >
                            <BrainCircuit className="h-6 w-6 group-hover:animate-pulse" />
                            AI Copilot
                        </Button>
                        <Button
                            size="lg"
                            className="bg-teal-500 hover:bg-teal-600 text-white shadow-xl px-8 h-14 text-lg font-bold rounded-2xl gap-3 group"
                            onClick={() => navigate('/appointments')}
                        >
                            <CalendarCheck className="h-6 w-6 group-hover:scale-110 transition-transform" />
                            Master Schedule
                        </Button>
                    </div>
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
                            <Users className="h-8 w-8" />
                        </div>
                        <div>
                            <div className="text-4xl font-black tracking-tight">{loading ? '...' : todayAppointments.length}</div>
                            <div className="text-sm font-bold uppercase tracking-widest text-blue-500/80">Today's Patients</div>
                        </div>
                    </GlassCard>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <GlassCard className="p-8 flex items-center gap-6" mesh meshVariant="accent">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-500 shadow-inner">
                            <ClipboardCheck className="h-8 w-8" />
                        </div>
                        <div>
                            <div className="text-4xl font-black tracking-tight">{loading ? '...' : pendingReviews}</div>
                            <div className="text-sm font-bold uppercase tracking-widest text-amber-500/80">Completed Encounters</div>
                        </div>
                    </GlassCard>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <GlassCard className="p-8 flex items-center gap-6" mesh meshVariant="secondary">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-500 shadow-inner">
                            <Contact className="h-8 w-8" />
                        </div>
                        <div>
                            <div className="text-4xl font-black tracking-tight">{loading ? '...' : patientCount}</div>
                            <div className="text-sm font-bold uppercase tracking-widest text-indigo-500/80">Primary Care Panel</div>
                        </div>
                    </GlassCard>
                </motion.div>
            </motion.div>

            {/* Predictive Intelligence Section */}
            <motion.div variants={itemVariants}>
                <PredictiveInsights insights={MOCK_DOCTOR_INSIGHTS} />
            </motion.div>

            {/* Clinical Analytics Visualization */}
            <motion.div variants={itemVariants}>
                <GlassCard className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold tracking-tight">Clinical Load Analysis</h2>
                            <p className="text-muted-foreground">Hourly patient flow and consultation density</p>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-teal-500/10 rounded-xl text-teal-600 font-bold text-sm">
                            <TrendingUp className="h-4 w-4" />
                            Optimal Flow
                        </div>
                    </div>

                    <div className="h-[250px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={MOCK_VOLUME_DATA}>
                                <defs>
                                    <linearGradient id="colorPatients" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground))" opacity={0.1} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--background))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="patients"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorPatients)"
                                />
                            </AreaChart>
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
                            <Card className="p-6 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all hover:border-primary hover:bg-muted/50 group" onClick={() => navigate('/patients/new')}>
                                <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                    <UserPlus className="h-6 w-6" />
                                </div>
                                <span className="font-medium">Add Patient</span>
                            </Card>
                            <Card className="p-6 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all hover:border-primary hover:bg-muted/50 group" onClick={() => navigate('/notes')}>
                                <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                    <ClipboardList className="h-6 w-6" />
                                </div>
                                <span className="font-medium">SOAP Notes</span>
                            </Card>
                            <Card className="p-6 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all hover:border-primary hover:bg-muted/50 group" onClick={() => navigate('/prescriptions/new')}>
                                <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                    <Pill className="h-6 w-6" />
                                </div>
                                <span className="font-medium">Prescribe</span>
                            </Card>
                            <Card className="p-6 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all hover:border-primary hover:bg-muted/50 group" onClick={() => navigate('/reports')}>
                                <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                    <BarChart3 className="h-6 w-6" />
                                </div>
                                <span className="font-medium">Reports</span>
                            </Card>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center justify-between">
                            Quick Info
                        </h2>
                        <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-6 flex items-center justify-between shadow-lg">
                            <div className="space-y-2">
                                <h3 className="text-lg font-bold">Appointments Overview</h3>
                                <div className="space-y-1 text-indigo-100">
                                    <p className="flex items-center gap-2">
                                        <span className="font-bold text-white text-xl">{appointments.length}</span> total appointments
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <span className="font-bold text-white text-xl">{todayAppointments.length}</span> scheduled today
                                    </p>
                                </div>
                            </div>
                            <CalendarIcon className="h-16 w-16 opacity-20" />
                        </Card>
                    </section>
                </div>

                {/* Right: Today's Schedule */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-foreground">Today's Schedule</h2>
                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-primary" onClick={() => navigate('/appointments')}>
                            Full Calendar <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {loading ? (
                            <Card className="p-8 text-center text-muted-foreground">
                                Loading schedule...
                            </Card>
                        ) : todayAppointments.length === 0 ? (
                            <AnimatedEmptyState
                                title="No Consultations Today"
                                description="Your clinical schedule is currently clear. It's a great time to update your SOAP notes or review reports."
                                icon={CalendarX}
                                suggestion="Consider opening 2 emergency slots for Gaborone North branch."
                                actionLabel="View Full Calendar"
                                onAction={() => navigate('/appointments')}
                            />
                        ) : (
                            todayAppointments.map((appointment) => {
                                const time = formatTime(appointment.appointment_time);
                                return (
                                    <Card key={appointment.id} className="group p-4 flex items-center gap-4 transition-all hover:shadow-md hover:border-primary/50">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg p-2 min-w-[70px] text-center shrink-0 border border-blue-100 dark:border-blue-900/50">
                                            <span className="block text-lg font-bold leading-none">{time.split(' ')[0]}</span>
                                            <span className="block text-xs font-bold uppercase mt-0.5">{time.split(' ')[1]}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="font-semibold truncate text-foreground">{appointment.other_party_name || 'Patient'}</h3>
                                            </div>
                                            <p className="text-sm text-muted-foreground truncate flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
                                                {appointment.reason}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="h-9 w-9 p-0 rounded-full shrink-0"
                                            onClick={() => navigate(`/consultation/${appointment.id}`)}
                                        >
                                            <Play className="h-3.5 w-3.5 ml-0.5" />
                                            <span className="sr-only">Start Consultation</span>
                                        </Button>
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
