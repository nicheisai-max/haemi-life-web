import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getMyAppointments } from '../../services/appointment.service';
import { getDoctorPatients } from '../../services/doctor.service';
import type { Appointment } from '../../services/appointment.service';
import {
    CalendarCheck, Users, ClipboardCheck, Contact, AlertCircle,
    UserPlus, ClipboardList, Pill, BarChart3, Calendar as CalendarIcon,
    ArrowRight, Play, CalendarX, BrainCircuit, Activity, Zap, Stethoscope
} from 'lucide-react';
import { GradientMesh } from '@/components/ui/GradientMesh';
import { PremiumAreaChart } from '@/components/charts/PremiumAreaChart';
import { TransitionItem } from '../../components/layout/PageTransition';
import { ClinicalCopilot } from '@/components/ui/ClinicalCopilot';
import { PredictiveInsights } from '@/components/ui/PredictiveInsights';
import { AnimatedEmptyState } from '@/components/ui/AnimatedEmptyState';
import { Loader } from '@/components/ui/Loader';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { IconWrapper } from '@/components/ui/IconWrapper';

const CLINICAL_VOLUME_DATA = [
    { name: '08:00', patients: 3 },
    { name: '10:00', patients: 6 },
    { name: '12:00', patients: 4 },
    { name: '14:00', patients: 7 },
    { name: '16:00', patients: 5 },
    { name: '18:00', patients: 2 },
];

const DOCTOR_INSIGHTS_DATA = [
    {
        label: 'Retention Rate',
        value: '94%',
        description: 'Your patient retention is 12% above Gaborone regional average.',
        trend: 'up' as const,
        trendValue: '+2.4%',
        icon: Users,
        variant: 'primary' as const
    },
    {
        label: 'Avg. Consult',
        value: '18m',
        description: 'Consultation efficiency has improved, opening 2 extra daily slots.',
        trend: 'down' as const,
        trendValue: '-15%',
        icon: Activity,
        variant: 'accent' as const
    },
    {
        label: 'BHPC Compliance',
        value: '100%',
        description: 'All protocols valid. Malpractice insurance renewal due in 45 days.',
        trend: 'neutral' as const,
        trendValue: 'Valid',
        icon: Zap,
        variant: 'secondary' as const
    }
];

export const DoctorDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
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
        return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-GB', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const todayAppointments = appointments.filter(a => {
        const apptDate = new Date(a.appointment_date);
        const today = new Date();
        return apptDate.toDateString() === today.toDateString() && a.status === 'scheduled';
    }).slice(0, 3);

    const pendingReviews = appointments.filter(a => a.status === 'completed').length;

    return (
        <main className="w-full mx-auto p-4 md:p-8 max-w-[1920px] space-y-8 relative overflow-x-hidden">
            <ClinicalCopilot isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />

            {/* Hero Section */}
            <TransitionItem className="relative overflow-hidden rounded-3xl border bg-slate-900 text-white shadow-xl">
                <GradientMesh variant="secondary" className="opacity-40" />
                <div className="relative z-10 p-6 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-3 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-[11px] font-bold border border-teal-500/30 backdrop-blur-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                            </span>
                            STATUS: ON-DUTY
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
                            Dr. {user?.name?.split(' ')[0]}
                        </h1>
                        <p className="text-white/80 text-lg font-medium leading-relaxed max-w-xl">
                            {loading
                                ? <Loader size="xs" className="text-white inline-block align-middle" />
                                : `You have ${todayAppointments.length} patients scheduled for today. Your vitals dashboard is trending positive.`
                            }
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full sm:w-auto">
                        <Button
                            size="lg"
                            variant="outline"
                            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/30 shadow-lg h-12 text-sm font-bold rounded-xl gap-2 group w-full sm:w-auto"
                            onClick={() => setIsCopilotOpen(true)}
                        >
                            <BrainCircuit className="h-5 w-5" aria-hidden="true" />
                            AI Copilot
                        </Button>
                        <Button
                            size="lg"
                            className="bg-teal-500 hover:bg-teal-600 text-white shadow-lg h-12 text-sm font-bold rounded-xl gap-2 group w-full sm:w-auto"
                            onClick={() => navigate('/appointments')}
                        >
                            <CalendarCheck className="h-5 w-5" aria-hidden="true" />
                            Manage Schedule
                        </Button>
                    </div>
                </div>
            </TransitionItem>

            {/* Error Message */}
            {error && (
                <TransitionItem className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-destructive flex items-center gap-3" role="alert">
                    <AlertCircle className="h-5 w-5" aria-hidden="true" />
                    <p className="text-sm font-medium">{error}</p>
                </TransitionItem>
            )}

            {/* Stats Grid */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6" aria-label="Key Metrics">
                <TransitionItem>
                    <DashboardCard className="flex items-center gap-5 hover:border-teal-500/50 transition-colors cursor-default">
                        <IconWrapper icon={Users} variant="primary" className="h-14 w-14" iconClassName="h-7 w-7" />
                        <div>
                            <div className="text-4xl font-bold tracking-tight text-foreground">
                                {loading ? <Loader size="xs" /> : todayAppointments.length}
                            </div>
                            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Today's Census</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex items-center gap-5 hover:border-emerald-500/50 transition-colors cursor-default">
                        <IconWrapper icon={ClipboardCheck} variant="success" className="h-14 w-14" iconClassName="h-7 w-7" />
                        <div>
                            <div className="text-4xl font-bold tracking-tight text-foreground">
                                {loading ? <Loader size="xs" /> : pendingReviews}
                            </div>
                            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Completed Notes</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex items-center gap-5 hover:border-blue-500/50 transition-colors cursor-default">
                        <IconWrapper icon={Contact} variant="accent" className="h-14 w-14" iconClassName="h-7 w-7" />
                        <div>
                            <div className="text-4xl font-bold tracking-tight text-foreground">
                                {loading ? <Loader size="xs" /> : patientCount}
                            </div>
                            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Total Panel</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>
            </section>

            {/* Predictive Intelligence Section */}
            <TransitionItem>
                <PredictiveInsights insights={DOCTOR_INSIGHTS_DATA} />
            </TransitionItem>

            {/* Clinical Analytics Visualization */}
            <TransitionItem>
                <PremiumAreaChart
                    title="Clinical Load (Gaborone)"
                    description="Hourly patient flow vs. Regional Average"
                    data={CLINICAL_VOLUME_DATA}
                    dataKey="patients"
                    categoryKey="name"
                    color="#0E6B74" // Primary-800
                    valueSuffix=" pts"
                    height={300}
                />
            </TransitionItem>

            {/* Main Content Split */}
            <TransitionItem className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
                {/* Left: Quick Actions */}
                <div className="space-y-8 flex flex-col h-full">
                    <section className="flex-1">
                        <h2 className="text-xl font-bold mb-4 text-foreground">Quick Actions</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 h-full">
                            <DashboardCard
                                className="flex flex-col items-center justify-center text-center gap-3 transition-all hover:bg-muted/50 hover:border-primary/50 cursor-pointer h-32 group"
                                onClick={() => navigate('/book-appointment')}
                                noPadding
                            >
                                <IconWrapper icon={UserPlus} className="group-hover:scale-110 transition-transform duration-200" />
                                <span className="font-semibold text-foreground text-sm">Add Patient</span>
                            </DashboardCard>
                            <DashboardCard
                                className="flex flex-col items-center justify-center text-center gap-3 transition-all hover:bg-muted/50 hover:border-primary/50 cursor-pointer h-32 group"
                                onClick={() => navigate('/records')}
                                noPadding
                            >
                                <IconWrapper icon={ClipboardList} className="group-hover:scale-110 transition-transform duration-200" />
                                <span className="font-semibold text-foreground text-sm">SOAP Notes</span>
                            </DashboardCard>
                            <DashboardCard
                                className="flex flex-col items-center justify-center text-center gap-3 transition-all hover:bg-muted/50 hover:border-primary/50 cursor-pointer h-32 group"
                                onClick={() => navigate('/prescriptions')}
                                noPadding
                            >
                                <IconWrapper icon={Pill} className="group-hover:scale-110 transition-transform duration-200" />
                                <span className="font-semibold text-foreground text-sm">Prescribe</span>
                            </DashboardCard>
                            <DashboardCard
                                className="flex flex-col items-center justify-center text-center gap-3 transition-all hover:bg-muted/50 hover:border-primary/50 cursor-pointer h-32 group"
                                onClick={() => navigate('/analytics')}
                                noPadding
                            >
                                <IconWrapper icon={BarChart3} className="group-hover:scale-110 transition-transform duration-200" />
                                <span className="font-semibold text-foreground text-sm">Reports</span>
                            </DashboardCard>
                        </div>
                    </section>

                    <section className="mt-auto">
                        <h2 className="text-xl font-bold mb-4 text-foreground flex items-center justify-between">
                            Clinical Snapshot
                        </h2>
                        <DashboardCard className="bg-gradient-to-br from-indigo-500 to-purple-700 text-white p-6 flex items-center justify-between shadow-lg border-none relative overflow-hidden">
                            <GradientMesh variant="subtle" className="opacity-30" />
                            <div className="space-y-3 relative z-10">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Stethoscope className="h-5 w-5" />
                                    Daily rounds
                                </h3>
                                <div className="space-y-1 text-indigo-100">
                                    <p className="flex items-center gap-3">
                                        <span className="font-bold text-white text-2xl">{appointments.filter(a => new Date(a.appointment_date).toDateString() === new Date().toDateString()).length}</span>
                                        <span className="text-sm opacity-80">Check-ins today</span>
                                    </p>
                                    <p className="flex items-center gap-3">
                                        <span className="font-bold text-white text-2xl">{pendingReviews}</span>
                                        <span className="text-sm opacity-80">Pending Sign-off</span>
                                    </p>
                                </div>
                            </div>
                            <CalendarIcon className="h-24 w-24 opacity-10 absolute -right-6 -bottom-6 rotate-[-15deg]" />
                        </DashboardCard>
                    </section>
                </div>

                {/* Right: Today's Schedule */}
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-foreground">Today's Schedule</h2>
                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-primary font-semibold" onClick={() => navigate('/appointments')}>
                            Full Calendar <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <div className="space-y-4 flex-1">
                        {loading ? (
                            <div className="flex justify-center p-12 h-full items-center">
                                <Loader />
                            </div>
                        ) : todayAppointments.length === 0 ? (
                            <AnimatedEmptyState
                                title="No Consultations Today"
                                description="Your clinical schedule is currently clear."
                                icon={CalendarX}
                                suggestion="Consider opening 2 emergency slots."
                                actionLabel="View Full Calendar"
                                onAction={() => navigate('/appointments')}
                            />
                        ) : (
                            todayAppointments.map((appointment) => {
                                const time = formatTime(appointment.appointment_time);
                                return (
                                    <DashboardCard key={appointment.id} className="group p-4 flex items-center gap-4 transition-all hover:border-primary/50 hover:bg-muted/30">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl p-3 min-w-[70px] text-center shrink-0 border border-blue-100 dark:border-blue-900/50">
                                            <span className="block text-lg font-bold leading-none">{time.split(' ')[0]}</span>
                                            <span className="block text-xs font-bold uppercase mt-1">{time.split(' ')[1]}</span>
                                        </div>

                                        <div className="shrink-0 relative">
                                            <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                                                <AvatarImage
                                                    src={`/images/patients/${appointment.other_party_name?.toLowerCase().replace(/[^a-z0-9]/g, '_')}.svg`}
                                                    alt={appointment.other_party_name || 'Patient'}
                                                />
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                                    {appointment.other_party_name?.slice(0, 2).toUpperCase() || 'PT'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="absolute -bottom-1 -right-1 bg-amber-400 w-2.5 h-2.5 rounded-full border-2 border-white"></div>
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
                                            className="h-9 w-9 p-0 rounded-full shrink-0 shadow-sm"
                                            onClick={() => navigate(`/consultation/${appointment.id}`)}
                                        >
                                            <Play className="h-3.5 w-3.5 ml-0.5" />
                                            <span className="sr-only">Start Consultation</span>
                                        </Button>
                                    </DashboardCard>
                                );
                            })
                        )}
                    </div>
                </div>
            </TransitionItem>
        </main>
    );
};
