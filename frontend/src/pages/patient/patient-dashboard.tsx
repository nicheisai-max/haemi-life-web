import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { getMyAppointments } from '../../services/appointment.service';
import { getMyPrescriptions } from '../../services/prescription.service';
import type { Appointment } from '../../services/appointment.service';
import type { Prescription } from '../../services/prescription.service';
import {
    Plus, Calendar, FileText, FolderOpen, AlertCircle,
    ThermometerSun, Search, History, Settings as SettingsIcon,
    CalendarX, Clock, Activity
} from 'lucide-react';
import { PATHS } from '../../routes/paths';
import { GradientMesh } from '@/components/ui/gradient-mesh';
import { PremiumAreaChart } from '@/components/charts/premium-area-chart';
import { TransitionItem } from '../../components/layout/page-transition';
import { PremiumLoader } from '@/components/ui/premium-loader';
import { DashboardCard } from '@/components/ui/dashboard-card';
import { IconWrapper } from '@/components/ui/icon-wrapper';

// REALISTIC BOTSWANA CONTEXT DATA
const HEALTH_TRENDS_DATA = [
    { name: 'Week 1', score: 72, label: 'Initial Vitals' },
    { name: 'Week 2', score: 75, label: 'Follow-up' },
    { name: 'Week 3', score: 74, label: 'Routine Check' },
    { name: 'Week 4', score: 82, label: 'Current Status' },
];

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
            setError(null);
            
            // Phase 2: Consolidated Real-Time Data Fetch (Optimized for Upcoming)
            const [apptData, prescData] = await Promise.all([
                getMyAppointments({ status: 'scheduled', upcoming: true }).catch(() => []),
                getMyPrescriptions().catch(() => [])
            ]);
            
            setAppointments(apptData || []);
            setPrescriptions(prescData || []);
            
        } catch (err) {
            console.error('Dashboard fetch error:', err);
            // Fail Safe: Return Empty State
            setAppointments([]);
            setPrescriptions([]);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return {
            day: date.getDate().toString(),
            month: date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase() // Botswana uses DD/MM/YYYY usually, keeping standard format
        };
    };

    const formatTime = (timeStr: string) => {
        return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-GB', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };



    const upcomingAppointments = appointments.slice(0, 3);
    const activePrescriptions = prescriptions.filter(p => p.status === 'pending' || p.status === 'filled');

    return (

        <div className="space-y-8">
            {/* Hero Section - Compact */}
            <TransitionItem className="relative overflow-hidden rounded-card border bg-gradient-to-br from-teal-800 to-teal-950 text-white shadow-xl">
                <GradientMesh variant="primary" className="opacity-20" />
                <div className="relative z-10 p-6 md:p-5 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-100 text-xs font-bold border border-emerald-500/30">
                            <span>Active Member</span>
                        </div>
                        <h1 className="page-heading !text-white !mb-0 transition-all duration-300">
                            Welcome, {user?.name}
                        </h1>
                        <p className="text-emerald-50/70 text-sm font-bold uppercase tracking-[0.2em] mb-1">Patient Hub</p>
                        <div className="page-subheading !text-white/80 !opacity-100 italic">
                            {loading
                                ? <PremiumLoader size="md" className="justify-start h-8 w-auto text-white" />
                                : `"Your health is our priority. Access your records and appointments securely."`
                            }
                        </div>
                    </div>
                    <Button
                        size="sm"
                        className="bg-white dark:bg-primary text-teal-900 dark:text-teal-950 hover:bg-teal-50 dark:hover:bg-primary/90 shadow-[0_0_20px_rgba(255,255,255,0.3)] dark:shadow-[0_0_20px_rgba(63,194,181,0.3)] px-6 h-10 text-sm font-bold rounded-xl border-none whitespace-nowrap transition-all duration-300 hover:scale-105 active:scale-95"
                        onClick={() => navigate(PATHS.PATIENT.BOOK_APPOINTMENT)}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Book Appointment
                    </Button>
                </div>
            </TransitionItem>

            {/* Error Message */}
            {error && (
                <TransitionItem className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive flex items-center gap-3" role="alert">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm font-medium">{error}</p>
                </TransitionItem>
            )}

            <TransitionItem className="flex flex-col lg:flex-row gap-6 items-stretch">
                {/* LEFT COLUMN (8/12) */}
                <div className="w-full lg:w-2/3 flex flex-col h-full space-y-6">

                    {/* Key Metrics - Compact Grid */}
                    <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-primary/50 dark:hover:border-primary/80 hover:shadow-lg hover:shadow-primary/10 dark:hover:shadow-primary/20 hover:-translate-y-1 transition-all duration-300 text-center group cursor-pointer" noPadding>
                            <IconWrapper icon={Calendar} variant="primary" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                            <div className="flex flex-col items-center gap-1.5">
                                <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                    {loading ? <PremiumLoader size="sm" className="h-9" /> : upcomingAppointments.length}
                                </div>
                                <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-primary transition-colors">Bookings</div>
                            </div>
                        </DashboardCard>

                        <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-emerald-500/50 dark:hover:border-emerald-500/80 hover:shadow-lg hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20 hover:-translate-y-1 transition-all duration-300 text-center group cursor-pointer" noPadding>
                            <IconWrapper icon={FileText} variant="success" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                            <div className="flex flex-col items-center gap-1.5">
                                <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                    {loading ? <PremiumLoader size="sm" className="h-9" /> : activePrescriptions.length}
                                </div>
                                <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">Scripts</div>
                            </div>
                        </DashboardCard>

                        <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-amber-500/50 dark:hover:border-amber-500/80 hover:shadow-lg hover:shadow-amber-500/10 dark:hover:shadow-amber-500/20 hover:-translate-y-1 transition-all duration-300 text-center group cursor-pointer col-span-2 md:col-span-1" noPadding>
                            <IconWrapper icon={FolderOpen} variant="warning" className="h-14 w-14 group-hover:scale-110 transition-transform duration-300" iconClassName="h-7 w-7" />
                            <div className="flex flex-col items-center gap-1.5">
                                <div className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                    {loading ? <PremiumLoader size="sm" className="h-9" /> : appointments.length}
                                </div>
                                <div className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-amber-500 transition-colors">Total Visits</div>
                            </div>
                        </DashboardCard>
                    </section>

                    {/* Chart Section */}
                    <section>
                        <PremiumAreaChart
                            title="Wellness Trends"
                            description="Stability score (Gaborone Region)"
                            data={HEALTH_TRENDS_DATA}
                            dataKey="score"
                            categoryKey="name"
                            color="#0E6B74"
                            valueSuffix=" pts"
                            height={250}
                        />
                    </section>

                    <div className="flex-1" />

                    {/* Quick Actions - 4 Col Grid */}
                    <section className="mt-auto">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                            Quick Actions
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                {
                                    icon: ThermometerSun,
                                    label: "Order Meds",
                                    path: "/prescriptions",
                                    color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
                                    hoverBorder: "hover:border-blue-500/50 dark:hover:border-blue-500/80",
                                    hoverShadow: "hover:shadow-blue-500/10 dark:hover:shadow-blue-500/20",
                                    hoverText: "group-hover:text-blue-600"
                                },
                                {
                                    icon: Search,
                                    label: "Find Doctor",
                                    path: PATHS.PATIENT.FIND_DOCTORS,
                                    color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20",
                                    hoverBorder: "hover:border-purple-500/50 dark:hover:border-purple-500/80",
                                    hoverShadow: "hover:shadow-purple-500/10 dark:hover:shadow-purple-500/20",
                                    hoverText: "group-hover:text-purple-600"
                                },
                                {
                                    icon: History,
                                    label: "History",
                                    path: "/records",
                                    color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
                                    hoverBorder: "hover:border-amber-500/50 dark:hover:border-amber-500/80",
                                    hoverShadow: "hover:shadow-amber-500/10 dark:hover:shadow-amber-500/20",
                                    hoverText: "group-hover:text-amber-600"
                                },
                                {
                                    icon: SettingsIcon,
                                    label: "settings",
                                    path: "/settings",
                                    color: "text-slate-600 bg-slate-50 dark:bg-slate-800",
                                    hoverBorder: "hover:border-slate-500/50 dark:hover:border-slate-500/80",
                                    hoverShadow: "hover:shadow-slate-500/10 dark:hover:shadow-slate-500/20",
                                    hoverText: "group-hover:text-slate-600"
                                },
                            ].map((action, idx) => (
                                <DashboardCard
                                    key={idx}
                                    className={`flex flex-col items-center justify-center gap-3 p-4 cursor-pointer transition-all duration-300 group hover:-translate-y-1 hover:shadow-lg ${action.hoverBorder} ${action.hoverShadow}`}
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
                </div>

                {/* RIGHT COLUMN (4/12) */}
                <div className="w-full lg:w-1/3 flex flex-col h-full space-y-6">

                    {/* Appointments List */}
                    <section className="bg-white dark:bg-slate-950/50 rounded-card border border-slate-200 dark:border-slate-800 flex-1 shadow-sm overflow-hidden backdrop-blur-sm flex flex-col min-h-0">
                        <div className="p-6 border-b border-transparent flex items-center justify-between">
                            <h2 className="font-bold text-slate-900 dark:text-white text-sm tracking-wide">Upcoming</h2>
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] font-semibold text-primary/80 hover:text-primary px-2 uppercase tracking-wider" onClick={() => navigate(PATHS.PATIENT.APPOINTMENTS)}>
                                View All
                            </Button>
                        </div>
                        <div className="p-6 pt-0 space-y-4 flex-1 overflow-y-auto min-h-0">
                            {loading ? (
                                <div className="flex justify-center p-8">
                                    <PremiumLoader size="xs" />
                                    <span className="ml-2 text-sm text-muted-foreground">Syncing records...</span>
                                </div>
                            ) : upcomingAppointments.length === 0 ? (
                                <div className="text-center py-8 px-4 flex flex-col items-center">
                                    <CalendarX className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2 opacity-50" />
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No appointments</p>
                                    <Button variant="link" size="sm" className="text-primary text-xs h-auto p-0 mt-1" onClick={() => navigate(PATHS.PATIENT.BOOK_APPOINTMENT)}>Book now</Button>
                                </div>
                            ) : (
                                upcomingAppointments.map((appointment) => {
                                    const dateInfo = formatDate(appointment.appointmentDate);
                                    const isToday = new Date(appointment.appointmentDate).toDateString() === new Date().toDateString();
                                    return (
                                        <button
                                            key={appointment.id}
                                            type="button"
                                            className={`w-full appearance-none bg-transparent border-none text-left flex gap-3 p-0 m-0 rounded-full !rounded-xl transition-all hover:bg-slate-100 dark:hover:bg-slate-800/50 group cursor-pointer ${isToday ? 'bg-primary/5' : ''}`}
                                            onClick={() => navigate(PATHS.CONSULTATION(appointment.id.toString()))}
                                        >
                                            <div className="flex gap-3 p-3 w-full">
                                                <div className="flex flex-col items-center justify-center h-11 w-11 shrink-0 bg-slate-100 dark:bg-slate-800/50 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white leading-none">{dateInfo.day}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{dateInfo.month}</span>
                                                </div>
                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">{appointment.otherPartyName || 'Doctor'}</h3>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                                        <span className="flex items-center gap-1 group-hover:text-primary transition-colors">
                                                            <Clock className="h-3 w-3" /> {formatTime(appointment.appointmentTime)}
                                                        </span>
                                                        {isToday && <span className="text-primary font-bold px-1.5 py-0.5 bg-primary/10 rounded ml-auto text-[9px]">TODAY</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </section>

                    {/* Compact Health Tip */}
                    <section className="bg-gradient-to-br from-teal-800 to-teal-950 rounded-card p-4 text-white relative overflow-hidden shadow-lg">
                        <GradientMesh variant="subtle" className="opacity-10" />
                        <div className="relative z-10 flex gap-4">
                            <div className="p-2.5 bg-white/10 rounded-xl h-fit backdrop-blur-sm">
                                <Activity className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm mb-1 text-white/90">Daily Tip: Hydration</h3>
                                <p className="text-xs text-white/70 leading-relaxed">
                                    Gaborone heat can be intense. Drink at least 3L of water today to stay hydrated.
                                </p>
                            </div>
                        </div>
                    </section>

                </div>
            </TransitionItem>
        </div>
    );
};
