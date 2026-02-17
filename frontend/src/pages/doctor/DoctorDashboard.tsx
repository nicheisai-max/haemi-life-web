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
    ArrowRight, Play, CalendarX, BrainCircuit, Activity, Zap
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
import { useLanguage } from '../../context/LanguageContext';

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

    const todayAppointments = appointments.filter(a => {
        const apptDate = new Date(a.appointment_date);
        const today = new Date();
        return apptDate.toDateString() === today.toDateString() && a.status === 'scheduled';
    }).slice(0, 3);

    const pendingReviews = appointments.filter(a => a.status === 'completed').length;

    return (
        <div className="w-full mx-auto p-4 md:p-8 max-w-[1920px] space-y-12 relative overflow-x-hidden">
            <ClinicalCopilot isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />

            {/* Hero Section */}
            <TransitionItem className="relative overflow-hidden rounded-3xl border bg-slate-900 text-white shadow-xl">
                <GradientMesh variant="secondary" className="opacity-40" />
                <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-400 text-[10px] font-bold border border-teal-500/30">
                            <span className="relative flex h-2 w-2">
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                            </span>
                            Shift: On-Duty
                        </div>
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                            Hi, Dr. {user?.name}
                        </h1>
                        <p className="text-white/70 text-base font-medium leading-relaxed">
                            {loading
                                ? <Loader size="xs" className="inline-block align-middle" />
                                : t('hero.subtitle_doctor').replace('{count}', todayAppointments.length.toString())
                            }
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                        <Button
                            size="sm"
                            variant="outline"
                            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/30 shadow-lg px-6 h-11 text-sm font-bold rounded-xl gap-2 group"
                            onClick={() => setIsCopilotOpen(true)}
                        >
                            <BrainCircuit className="h-4 w-4" />
                            AI Copilot
                        </Button>
                        <Button
                            size="sm"
                            className="bg-teal-500 hover:bg-teal-600 text-white shadow-lg px-6 h-11 text-sm font-bold rounded-xl gap-2 group"
                            onClick={() => navigate('/appointments')}
                        >
                            <CalendarCheck className="h-4 w-4" />
                            Schedule
                        </Button>
                    </div>
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
                        <IconWrapper icon={Users} variant="primary" />
                        <div>
                            <div className="text-3xl font-bold tracking-tight text-foreground">
                                {loading ? <Loader size="xs" /> : todayAppointments.length}
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">Today's Patients</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex items-center gap-4">
                        <IconWrapper icon={ClipboardCheck} variant="success" />
                        <div>
                            <div className="text-3xl font-bold tracking-tight text-foreground">
                                {loading ? <Loader size="xs" /> : pendingReviews}
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">Completed Encounters</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex items-center gap-4">
                        <IconWrapper icon={Contact} variant="accent" />
                        <div>
                            <div className="text-3xl font-bold tracking-tight text-foreground">
                                {loading ? <Loader size="xs" /> : patientCount}
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">Primary Care Panel</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>
            </div>

            {/* Predictive Intelligence Section */}
            <TransitionItem>
                <PredictiveInsights insights={MOCK_DOCTOR_INSIGHTS} />
            </TransitionItem>

            {/* Clinical Analytics Visualization */}
            <TransitionItem>
                <PremiumAreaChart
                    title="Clinical Load Analysis"
                    description="Hourly patient flow and consultation density"
                    data={MOCK_VOLUME_DATA}
                    dataKey="patients"
                    categoryKey="name"
                    color="#0E6B74" // Primary-800
                    valueSuffix=" pts"
                />
            </TransitionItem>

            {/* Main Content Split */}
            <TransitionItem className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
                {/* Left: Quick Actions */}
                <div className="space-y-8">
                    <section>
                        <h2 className="text-xl font-semibold mb-4 text-foreground">Quick Actions</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <DashboardCard className="flex flex-col items-center justify-center text-center gap-3 transition-all hover:bg-muted/50 opacity-50 cursor-not-allowed">
                                <IconWrapper icon={UserPlus} />
                                <span className="font-medium text-foreground">Add Patient</span>
                            </DashboardCard>
                            <DashboardCard className="flex flex-col items-center justify-center text-center gap-3 transition-all hover:bg-muted/50 opacity-50 cursor-not-allowed">
                                <IconWrapper icon={ClipboardList} />
                                <span className="font-medium text-foreground">SOAP Notes</span>
                            </DashboardCard>
                            <DashboardCard className="flex flex-col items-center justify-center text-center gap-3 transition-all hover:bg-muted/50 opacity-50 cursor-not-allowed">
                                <IconWrapper icon={Pill} />
                                <span className="font-medium text-foreground">Prescribe</span>
                            </DashboardCard>
                            <DashboardCard className="flex flex-col items-center justify-center text-center gap-3 transition-all hover:bg-muted/50 opacity-50 cursor-not-allowed">
                                <IconWrapper icon={BarChart3} />
                                <span className="font-medium text-foreground">Reports</span>
                            </DashboardCard>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center justify-between">
                            Quick Info
                        </h2>
                        <DashboardCard className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-6 flex items-center justify-between shadow-lg border-none">
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
                        </DashboardCard>
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
                            <div className="flex justify-center p-8">
                                <Loader />
                            </div>
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
                                    <DashboardCard key={appointment.id} className="group p-4 flex items-center gap-4 transition-all hover:border-primary/50">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg p-2 min-w-[70px] text-center shrink-0 border border-blue-100 dark:border-blue-900/50">
                                            <span className="block text-lg font-bold leading-none">{time.split(' ')[0]}</span>
                                            <span className="block text-xs font-bold uppercase mt-0.5">{time.split(' ')[1]}</span>
                                        </div>

                                        <div className="shrink-0">
                                            <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                                                <AvatarImage
                                                    src={`/images/patients/${appointment.other_party_name?.toLowerCase().replace(/[^a-z0-9]/g, '_')}.svg`}
                                                    alt={appointment.other_party_name || 'Patient'}
                                                />
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                                    {appointment.other_party_name?.slice(0, 2).toUpperCase() || 'PT'}
                                                </AvatarFallback>
                                            </Avatar>
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
                                    </DashboardCard>
                                );
                            })
                        )}
                    </div>
                </div>
            </TransitionItem>
        </div>
    );
};
