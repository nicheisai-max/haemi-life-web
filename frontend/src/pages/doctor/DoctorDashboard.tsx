import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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
import { PATHS } from '../../routes/paths';
import { ClinicalCopilot } from '@/components/ui/ClinicalCopilot';
import { PredictiveInsights } from '@/components/ui/PredictiveInsights';
import { AnimatedEmptyState } from '@/components/ui/AnimatedEmptyState';
import { PremiumLoader } from '@/components/ui/PremiumLoader';
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

export const DoctorDashboard = () => {
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
        } catch (err) {
            const apiError = err as { response?: { data?: { message?: string } } };
            setError(apiError.response?.data?.message || 'Failed to load dashboard data');
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
        <div className="space-y-8">
            <ClinicalCopilot isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />

            {/* Hero Section - Standardized Premium Style */}
            <TransitionItem className="relative overflow-hidden rounded-card border bg-gradient-to-br from-teal-800 to-teal-950 text-white shadow-xl">
                <GradientMesh variant="primary" className="opacity-20" />
                <div className="relative z-10 p-6 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-3 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-100 text-[11px] font-bold border border-emerald-500/30 backdrop-blur-sm">
                            STATUS: ON-DUTY
                        </div>
                        <h1 className="page-heading !text-white !mb-0 transition-all duration-300">
                            Welcome, {user?.name}
                        </h1>
                        <p className="text-emerald-50/70 text-sm font-bold uppercase tracking-[0.2em] mb-1">Doctor's Portal</p>
                        <div className="page-subheading !text-white/80 !opacity-100 italic">
                            {loading
                                ? <PremiumLoader size="md" className="justify-start h-8 w-auto text-white" />
                                : `You have ${appointments.length} appointments scheduled for today.`
                            }
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full sm:w-auto">
                        <Button
                            size="lg"
                            variant="outline"
                            className="bg-white/10 hover:bg-white hover:text-teal-900 dark:hover:bg-white/20 dark:hover:text-white text-white border-white/20 shadow-lg h-12 text-sm font-bold rounded-xl gap-2 group w-full sm:w-auto transition-all duration-200"
                            onClick={() => {
                                // Coordination: Close chathub when opening copilot
                                if (!isCopilotOpen) {
                                    window.dispatchEvent(new CustomEvent('haemi-close-chathub'));
                                }
                                setIsCopilotOpen(true);
                            }}
                        >
                            <BrainCircuit className="h-5 w-5" aria-hidden="true" />
                            AI Copilot
                        </Button>
                        <Button
                            size="lg"
                            className="bg-white dark:bg-primary text-teal-900 dark:text-teal-950 hover:bg-teal-50 dark:hover:bg-primary/90 shadow-[0_0_20px_rgba(255,255,255,0.3)] dark:shadow-[0_0_20px_rgba(63,194,181,0.3)] h-12 text-sm font-bold rounded-xl gap-2 group w-full sm:w-auto transition-all duration-300 hover:scale-105 active:scale-95 border-none"
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
            <section className="grid grid-cols-2 md:grid-cols-3 gap-6" aria-label="Key Metrics">
                <TransitionItem>
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-teal-500/50 dark:hover:border-teal-500/80 hover:shadow-lg hover:shadow-teal-500/10 dark:hover:shadow-teal-500/20 hover:-translate-y-1 transition-all duration-300 text-center group cursor-pointer" noPadding>
                        <IconWrapper icon={Users} variant="primary" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                {loading ? <PremiumLoader size="sm" className="justify-start" /> : todayAppointments.length}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-teal-600 transition-colors">Today's Census</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-emerald-500/50 dark:hover:border-emerald-500/80 hover:shadow-lg hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20 hover:-translate-y-1 transition-all duration-300 text-center group cursor-pointer" noPadding>
                        <IconWrapper icon={ClipboardCheck} variant="success" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                {loading ? <PremiumLoader size="sm" className="justify-start" /> : pendingReviews}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-emerald-600 transition-colors">Completed Notes</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem className="col-span-2 md:col-span-1">
                    <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-blue-500/50 dark:hover:border-blue-500/80 hover:shadow-lg hover:shadow-blue-500/10 dark:hover:shadow-blue-500/20 hover:-translate-y-1 transition-all duration-300 text-center group cursor-pointer" noPadding>
                        <IconWrapper icon={Contact} variant="accent" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                {loading ? <PremiumLoader size="sm" className="justify-start" /> : patientCount}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-blue-600 transition-colors">Total Panel</div>
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
            <TransitionItem className="flex flex-col lg:flex-row gap-8 items-stretch min-h-[500px]">
                {/* Left: Quick Actions + Clinical Snapshot */}
                <div className="flex flex-col w-full lg:w-3/5 h-full">
                    <section className="mb-8">
                        <h2 className="text-xl font-bold mb-4 text-foreground">Quick Actions</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                {
                                    icon: UserPlus,
                                    label: "Add Patient",
                                    path: PATHS.PATIENT.BOOK_APPOINTMENT,
                                    color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
                                    hoverBorder: "hover:border-blue-500/50 dark:hover:border-blue-500/80",
                                    hoverShadow: "hover:shadow-blue-500/10 dark:hover:shadow-blue-500/20",
                                    hoverText: "group-hover:text-blue-600"
                                },
                                {
                                    icon: ClipboardList,
                                    label: "SOAP Notes",
                                    path: PATHS.PATIENT.MEDICAL_RECORDS,
                                    color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20",
                                    hoverBorder: "hover:border-purple-500/50 dark:hover:border-purple-500/80",
                                    hoverShadow: "hover:shadow-purple-500/10 dark:hover:shadow-purple-500/20",
                                    hoverText: "group-hover:text-purple-600"
                                },
                                {
                                    icon: Pill,
                                    label: "Prescribe",
                                    path: "/prescriptions",
                                    color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
                                    hoverBorder: "hover:border-emerald-500/50 dark:hover:border-emerald-500/80",
                                    hoverShadow: "hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20",
                                    hoverText: "group-hover:text-emerald-600"
                                },
                                {
                                    icon: BarChart3,
                                    label: "Reports",
                                    path: PATHS.DOCTOR.REPORTS,
                                    color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
                                    hoverBorder: "hover:border-amber-500/50 dark:hover:border-amber-500/80",
                                    hoverShadow: "hover:shadow-amber-500/10 dark:hover:shadow-amber-500/20",
                                    hoverText: "group-hover:text-amber-600"
                                },
                            ].map((action, idx) => (
                                <DashboardCard
                                    key={idx}
                                    className={`flex flex-col items-center justify-center gap-3 p-4 cursor-pointer transition-all duration-300 group hover:-translate-y-1 hover:shadow-lg h-32 ${action.hoverBorder} ${action.hoverShadow}`}
                                    onClick={() => navigate(action.path)}
                                    noPadding
                                >
                                    <div className={`p-3 rounded-full ${action.color} group-hover:scale-110 transition-transform duration-300`}>
                                        <action.icon className="h-6 w-6" />
                                    </div>
                                    <span className={`font-semibold text-slate-700 dark:text-slate-200 text-xs uppercase tracking-wide transition-colors ${action.hoverText}`}>{action.label}</span>
                                </DashboardCard>
                            ))}
                        </div>
                    </section>

                    <div className="flex-1" />

                    <section className="mt-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-foreground">Clinical Snapshot</h2>
                        </div>
                        <DashboardCard className="bg-gradient-to-br from-teal-600 to-teal-800 text-white flex items-center justify-between shadow-lg border-teal-500/20 relative overflow-hidden group hover:shadow-teal-500/20 transition-all" noPadding={false}>
                            <GradientMesh variant="primary" className="opacity-20 mix-blend-overlay" />
                            <div className="space-y-4 relative z-10 w-full">
                                <h3 className="text-lg font-bold flex items-center gap-2 text-teal-50">
                                    <Stethoscope className="h-5 w-5 text-teal-200" />
                                    Daily Rounds
                                </h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-3xl font-bold text-white tracking-tight">{appointments.filter(a => new Date(a.appointment_date).toDateString() === new Date().toDateString()).length}</p>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-teal-100/70">Check-ins</p>
                                    </div>
                                    <div className="space-y-1 border-l border-teal-500/30 pl-4">
                                        <p className="text-3xl font-bold text-white tracking-tight">{pendingReviews}</p>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-teal-100/70">Pending Sign-off</p>
                                    </div>
                                </div>
                            </div>
                            <CalendarIcon className="h-32 w-32 opacity-10 text-teal-100 absolute -right-8 -bottom-8 rotate-[-15deg] group-hover:scale-110 transition-transform duration-500" />
                        </DashboardCard>
                    </section>
                </div>

                {/* Right: Today's Schedule */}
                <div className="flex flex-col w-full lg:w-2/5 h-full">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-foreground">Today's Schedule</h2>
                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-primary font-semibold" onClick={() => navigate(PATHS.PATIENT.APPOINTMENTS)}>
                            Full Calendar <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <div className="flex-1 bg-white dark:bg-slate-950/50 rounded-card border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden backdrop-blur-sm flex flex-col min-h-0">
                        <div className="p-6 flex-1 overflow-y-auto min-h-0">
                            {loading ? (
                                <div className="flex justify-center p-12 h-full items-center">
                                    <PremiumLoader size="md" />
                                </div>
                            ) : todayAppointments.length === 0 ? (
                                <div className="h-full flex items-center justify-center">
                                    <AnimatedEmptyState
                                        title="No Consultations Today"
                                        description="Your clinical schedule is currently clear."
                                        icon={CalendarX}
                                        suggestion="Consider opening 2 emergency slots."
                                        actionLabel="View Full Calendar"
                                        onAction={() => navigate(PATHS.PATIENT.APPOINTMENTS)}
                                        variant="minimal"
                                    />
                                </div>
                            ) : (
                                todayAppointments.map((appointment) => {
                                    const time = formatTime(appointment.appointment_time);
                                    return (
                                        <DashboardCard key={appointment.id} className="group p-4 flex items-center gap-4 transition-all hover:border-primary/50 hover:bg-muted/30">
                                            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl p-3 w-20 text-center shrink-0 border border-blue-100 dark:border-blue-900/50">
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
                                                onClick={() => navigate(PATHS.CONSULTATION(appointment.id.toString()))}
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
                </div>
            </TransitionItem>
        </div>
    );
};
