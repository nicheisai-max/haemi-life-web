import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { getMyAppointments } from '../../services/appointment.service';
import { getMyPrescriptions } from '../../services/prescription.service';
import type { Appointment } from '../../services/appointment.service';
import type { Prescription } from '../../services/prescription.service';
import {
    Plus, Calendar, FileText, FolderOpen, AlertCircle,
    ThermometerSun, Search, History, Settings as SettingsIcon,
    CalendarX, Clock, ArrowRight, Heart, Activity
} from 'lucide-react';
import { PATHS } from '../../routes/paths';
import { GradientMesh } from '@/components/ui/GradientMesh';
import { PremiumAreaChart } from '@/components/charts/PremiumAreaChart';
import { TransitionItem } from '../../components/layout/PageTransition';
import { MedicalLoader } from '@/components/ui/MedicalLoader';
import { DashboardCard } from '@/components/ui/DashboardCard';

// REALISTIC BOTSWANA CONTEXT DATA
const HEALTH_TRENDS_DATA = [
    { name: 'Week 1', score: 72, label: 'Initial Vitals' },
    { name: 'Week 2', score: 75, label: 'Follow-up' },
    { name: 'Week 3', score: 74, label: 'Routine Check' },
    { name: 'Week 4', score: 82, label: 'Current Status' },
];

export const PatientDashboard = () => {
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
        } catch (err) {
            const apiError = err as { response?: { data?: { message?: string } } };
            setError(apiError.response?.data?.message || 'Failed to load dashboard data');
            console.error('Dashboard fetch error:', err);
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

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const upcomingAppointments = appointments.filter(a => a.status === 'scheduled').slice(0, 3);
    const activePrescriptions = prescriptions.filter(p => p.status === 'pending' || p.status === 'filled');

    return (

        <main className="w-full mx-auto p-4 md:p-6 pb-16 md:pb-20 max-w-[1600px] space-y-6">
            {/* Hero Section - Compact */}
            <TransitionItem className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-teal-800 to-teal-950 text-white shadow-xl">
                <GradientMesh variant="primary" className="opacity-20" />
                <div className="relative z-10 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                                {getGreeting()}, {user?.name?.split(' ')[0]}
                            </h1>
                            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-100 text-xs font-bold border border-emerald-500/30">
                                <Heart className="h-3 w-3 fill-current" />
                                <span>Active Member</span>
                            </div>
                        </div>
                        <p className="text-white/80 text-sm md:text-base font-medium max-w-xl">
                            {loading
                                ? "Loading your health status..."
                                : upcomingAppointments.length > 0
                                    ? `You have ${upcomingAppointments.length} upcoming consultation${upcomingAppointments.length === 1 ? '' : 's'}.`
                                    : "No upcoming appointments scheduled."
                            }
                        </p>
                    </div>
                    <Button
                        size="sm"
                        className="bg-white text-teal-900 hover:bg-white/90 shadow-lg px-6 h-10 text-sm font-bold rounded-xl border-none whitespace-nowrap transition-transform active:scale-95"
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT COLUMN (8/12) */}
                <div className="lg:col-span-8 space-y-6">

                    {/* Key Metrics - Compact Grid */}
                    <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-primary/50 dark:hover:border-primary/80 hover:shadow-lg hover:shadow-primary/10 dark:hover:shadow-primary/20 hover:-translate-y-1 transition-all duration-300 text-center group cursor-pointer" noPadding>
                            <div className="p-4 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Calendar className="h-7 w-7" />
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="text-3xl font-bold text-slate-900 dark:text-white leading-none">
                                    {loading ? "-" : upcomingAppointments.length}
                                </div>
                                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-primary transition-colors">Bookings</div>
                            </div>
                        </DashboardCard>

                        <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-emerald-500/50 dark:hover:border-emerald-500/80 hover:shadow-lg hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20 hover:-translate-y-1 transition-all duration-300 text-center group cursor-pointer" noPadding>
                            <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                                <FileText className="h-7 w-7" />
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="text-3xl font-bold text-slate-900 dark:text-white leading-none">
                                    {loading ? "-" : activePrescriptions.length}
                                </div>
                                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-emerald-500 transition-colors">Scripts</div>
                            </div>
                        </DashboardCard>

                        <DashboardCard className="flex flex-col items-center justify-center gap-4 p-6 hover:border-amber-500/50 dark:hover:border-amber-500/80 hover:shadow-lg hover:shadow-amber-500/10 dark:hover:shadow-amber-500/20 hover:-translate-y-1 transition-all duration-300 text-center group cursor-pointer" noPadding>
                            <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                                <FolderOpen className="h-7 w-7" />
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="text-3xl font-bold text-slate-900 dark:text-white leading-none">
                                    {loading ? "-" : appointments.length}
                                </div>
                                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-amber-500 transition-colors">Total Visits</div>
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

                    {/* Quick Actions - 4 Col Grid */}
                    <section>
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
                                    label: "Settings",
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
                <div className="lg:col-span-4 space-y-6">

                    {/* Appointments List */}
                    <section className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-full shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                            <h2 className="font-bold text-slate-900 dark:text-white text-sm">Upcoming</h2>
                            <Button variant="ghost" size="sm" className="h-6 text-xs text-primary hover:text-primary-700 px-2" onClick={() => navigate(PATHS.PATIENT.APPOINTMENTS)}>
                                View All
                            </Button>
                        </div>

                        <div className="p-3 space-y-3 flex-1">
                            {loading ? (
                                <div className="flex justify-center p-8">
                                    <MedicalLoader message="Syncing records..." />
                                </div>
                            ) : upcomingAppointments.length === 0 ? (
                                <div className="text-center py-8 px-4 flex flex-col items-center">
                                    <CalendarX className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2" />
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No appointments</p>
                                    <Button variant="link" size="sm" className="text-primary text-xs h-auto p-0 mt-1" onClick={() => navigate(PATHS.PATIENT.BOOK_APPOINTMENT)}>Book now</Button>
                                </div>
                            ) : (
                                upcomingAppointments.map((appointment) => {
                                    const dateInfo = formatDate(appointment.appointment_date);
                                    const isToday = new Date(appointment.appointment_date).toDateString() === new Date().toDateString();
                                    return (
                                        <div key={appointment.id} className={`flex gap-3 p-3 rounded-xl border transition-all hover:shadow-sm ${isToday ? 'bg-primary/5 border-primary/20' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
                                            <div className="flex flex-col items-center justify-center min-w-[50px] bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 h-14">
                                                <span className="text-lg font-bold text-slate-900 dark:text-white leading-none">{dateInfo.day}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{dateInfo.month}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">{appointment.other_party_name || 'Doctor'}</h3>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {formatTime(appointment.appointment_time)}
                                                    </span>
                                                    {isToday && <span className="text-primary font-bold px-1.5 py-0.5 bg-primary/10 rounded ml-auto">TODAY</span>}
                                                </div>
                                            </div>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                                                onClick={() => navigate(PATHS.CONSULTATION(appointment.id.toString()))}
                                            >
                                                <ArrowRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </section>

                    {/* Compact Health Tip */}
                    <section className="bg-gradient-to-br from-teal-800 to-teal-950 rounded-2xl p-4 text-white relative overflow-hidden shadow-lg">
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
            </div>
        </main>
    );
};
