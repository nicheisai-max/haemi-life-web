import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getMyAppointments } from '../../services/appointment.service';
import { getMyPrescriptions } from '../../services/prescription.service';
import type { Appointment } from '../../services/appointment.service';
import type { Prescription } from '../../services/prescription.service';
import {
    Plus, Calendar, FileText, FolderOpen, AlertCircle,
    ThermometerSun, Search, History, Settings as SettingsIcon,
    CalendarX, Clock, ArrowRight, Heart
} from 'lucide-react';
import { GradientMesh } from '@/components/ui/GradientMesh';
import { PremiumAreaChart } from '@/components/charts/PremiumAreaChart';
import { TransitionItem } from '../../components/layout/PageTransition';
import { Loader } from '@/components/ui/Loader';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { IconWrapper } from '@/components/ui/IconWrapper';

const MOCK_HEALTH_DATA = [
    { name: 'Week 1', score: 65 },
    { name: 'Week 2', score: 72 },
    { name: 'Week 3', score: 68 },
    { name: 'Week 4', score: 85 },
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
        <div className="w-full mx-auto p-4 md:p-8 max-w-[1920px] space-y-8">
            {/* Hero Section */}
            <TransitionItem className="relative overflow-hidden rounded-3xl border bg-slate-900 text-white shadow-2xl">
                <GradientMesh variant="primary" className="opacity-40" />
                <div className="relative z-10 p-6 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                    <div className="space-y-4 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 text-primary-foreground text-sm font-bold border border-primary/30">
                            <Heart className="h-4 w-4 fill-current" />
                            Premium Care Status: Active
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                            {getGreeting()}, {user?.name}
                        </h1>
                        <div className="text-white/70 text-lg md:text-xl font-medium leading-relaxed">
                            {loading
                                ? <Loader size="xs" className="inline-block align-middle" />
                                : `Your health mission is on track. You have ${upcomingAppointments.length} upcoming consultations to optimize your well-being.`
                            }
                        </div>
                    </div>
                    <Button
                        size="lg"
                        className="bg-primary hover:bg-primary/90 text-white shadow-xl px-8 h-14 text-lg font-bold rounded-2xl shrink-0 gap-3"
                        onClick={() => navigate('/book-appointment')}
                    >
                        <Plus className="h-6 w-6" />
                        Book Appointment
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
                        <IconWrapper icon={Calendar} variant="accent" />
                        <div>
                            <div className="text-3xl font-bold tracking-tight text-foreground">
                                {loading ? <Loader size="xs" /> : upcomingAppointments.length}
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">Active Bookings</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex items-center gap-4">
                        <IconWrapper icon={FileText} variant="success" />
                        <div>
                            <div className="text-3xl font-bold tracking-tight text-foreground">
                                {loading ? <Loader size="xs" /> : activePrescriptions.length}
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">Active Scripts</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>

                <TransitionItem>
                    <DashboardCard className="flex items-center gap-4">
                        <IconWrapper icon={FolderOpen} variant="warning" />
                        <div>
                            <div className="text-3xl font-bold tracking-tight text-foreground">
                                {loading ? <Loader size="xs" /> : appointments.length}
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">Lifetime Visits</div>
                        </div>
                    </DashboardCard>
                </TransitionItem>
            </div>

            {/* Health Pulse Visualization */}
            <TransitionItem>
                <PremiumAreaChart
                    title="Your Health Pulse"
                    description="Wellness score and activity trends over the last month"
                    data={MOCK_HEALTH_DATA}
                    dataKey="score"
                    categoryKey="name"
                    color="#0E6B74"
                    valueSuffix=" pts"
                />
            </TransitionItem>

            {/* Main Content Split */}
            <TransitionItem className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
                {/* Left: Quick Actions & Tips */}
                <div className="space-y-8">
                    <section>
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
                            Quick Actions
                        </h2>
                        <div className="grid grid-cols-2 gap-4">
                            <DashboardCard
                                className="flex flex-col items-center justify-center text-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                                onClick={() => navigate('/prescriptions')}
                            >
                                <IconWrapper icon={ThermometerSun} />
                                <span className="font-medium text-foreground">Order Medicine</span>
                            </DashboardCard>
                            <DashboardCard
                                className="flex flex-col items-center justify-center text-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                                onClick={() => navigate('/doctors')}
                            >
                                <IconWrapper icon={Search} />
                                <span className="font-medium text-foreground">Find Doctor</span>
                            </DashboardCard>
                            <DashboardCard
                                className="flex flex-col items-center justify-center text-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                                onClick={() => navigate('/records')}
                            >
                                <IconWrapper icon={History} />
                                <span className="font-medium text-foreground">View History</span>
                            </DashboardCard>
                            <DashboardCard
                                className="flex flex-col items-center justify-center text-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                                onClick={() => navigate('/settings')}
                            >
                                <IconWrapper icon={SettingsIcon} />
                                <span className="font-medium text-foreground">Settings</span>
                            </DashboardCard>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4 text-foreground">Health Tips</h2>
                        <DashboardCard className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-none relative overflow-hidden">
                            <GradientMesh variant="subtle" className="opacity-20" />
                            <div className="flex items-start justify-between relative z-10">
                                <div className="space-y-2 max-w-[80%]">
                                    <h3 className="text-lg font-bold">Stay Hydrated</h3>
                                    <p className="text-primary-foreground/90 leading-relaxed">
                                        Drinking enough water is crucial for regulating body temperature and maintaining organ function.
                                    </p>
                                </div>
                                <ThermometerSun className="h-12 w-12 opacity-20" />
                            </div>
                        </DashboardCard>
                    </section>
                </div>

                {/* Right: Upcoming Appointments */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-foreground">Appointments</h2>
                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-primary" onClick={() => navigate('/appointments')}>
                            View All <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {loading ? (
                            <div className="flex justify-center p-8">
                                <Loader />
                            </div>
                        ) : upcomingAppointments.length === 0 ? (
                            <DashboardCard className="text-center text-muted-foreground flex flex-col items-center justify-center min-h-[200px]">
                                <CalendarX className="h-12 w-12 opacity-20 mb-3" />
                                <p>No upcoming appointments</p>
                                <Button variant="link" className="mt-2 text-primary" onClick={() => navigate('/book-appointment')}>Book now</Button>
                            </DashboardCard>
                        ) : (
                            upcomingAppointments.map((appointment) => {
                                const dateInfo = formatDate(appointment.appointment_date);
                                return (
                                    <DashboardCard key={appointment.id} className="flex items-center gap-4 transition-all hover:border-primary/50 p-4">
                                        <div className="bg-muted rounded-lg p-2 min-w-[60px] text-center shrink-0 border">
                                            <span className="block text-xl font-bold leading-none text-foreground">{dateInfo.day}</span>
                                            <span className="block text-xs font-bold text-muted-foreground uppercase mt-0.5">{dateInfo.month}</span>
                                        </div>

                                        <div className="shrink-0">
                                            <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                                                <AvatarImage
                                                    src={`/images/doctors/${appointment.other_party_name?.toLowerCase().replace(/[^a-z0-9]/g, '_')}.svg`}
                                                    alt={appointment.other_party_name || 'Doctor'}
                                                />
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                                    {appointment.other_party_name?.slice(0, 2).toUpperCase() || 'DR'}
                                                </AvatarFallback>
                                            </Avatar>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold truncate text-foreground">{appointment.other_party_name || 'Doctor'}</h3>
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
                                                className="shadow-sm"
                                                onClick={() => navigate(`/consultation/${appointment.id}`)}
                                            >
                                                Join
                                            </Button>
                                        </div>
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
