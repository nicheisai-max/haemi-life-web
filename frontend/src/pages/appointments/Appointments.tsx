import React, { useState, useEffect } from 'react';
import { useConfirm } from '../../context/AlertDialogContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getMyAppointments, cancelAppointment, updateAppointmentStatus, deleteAppointment } from '../../services/appointment.service';
import type { Appointment } from '../../services/appointment.service';
import { Plus, AlertCircle, CalendarX, Clock, Calendar, Trash2 } from 'lucide-react';
import { MedicalLoader } from '@/components/ui/MedicalLoader';

import { TransitionItem } from '../../components/layout/PageTransition';

export const Appointments: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');

    useEffect(() => {
        fetchAppointments();
    }, []);

    useEffect(() => {
        applyFilter();
    }, [filter, appointments]);

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            const data = await getMyAppointments({});
            setAppointments(data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load appointments');
        } finally {
            setLoading(false);
        }
    };

    const applyFilter = () => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        let filtered = appointments;

        if (filter === 'upcoming') {
            filtered = appointments.filter(apt => {
                const aptDate = new Date(apt.appointment_date);
                aptDate.setHours(0, 0, 0, 0);
                return aptDate >= now && apt.status !== 'cancelled';
            });
        } else if (filter === 'past') {
            filtered = appointments.filter(apt => {
                const aptDate = new Date(apt.appointment_date);
                aptDate.setHours(0, 0, 0, 0);
                return aptDate < now || apt.status === 'completed' || apt.status === 'cancelled';
            });
        }

        setFilteredAppointments(filtered);
    };

    const { confirm } = useConfirm();

    const handleCancel = async (appointmentId: number) => {
        const isConfirmed = await confirm({
            title: 'Cancel Appointment',
            message: 'Are you sure you want to cancel this appointment? This action cannot be undone.',
            type: 'warning',
            confirmText: 'Yes, Cancel It',
            cancelText: 'No, Keep It'
        });

        if (!isConfirmed) return;

        try {
            await cancelAppointment(appointmentId);
            await fetchAppointments();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to cancel appointment');
        }
    };

    const handleDelete = async (e: React.MouseEvent, appointmentId: number) => {
        e.stopPropagation();

        await confirm({
            title: 'Delete Appointment',
            message: 'Are you sure you want to permanently delete this appointment record? This action cannot be undone and will remove all history.',
            type: 'error',
            confirmText: 'Delete Record',
            cancelText: 'Cancel',
            onAsyncConfirm: async () => {
                await deleteAppointment(appointmentId);
                setAppointments(prev => prev.filter(a => a.id !== appointmentId));
            }
        });
    };

    const handleComplete = async (appointmentId: number) => {
        try {
            await updateAppointmentStatus(appointmentId, 'completed');
            await fetchAppointments();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to update appointment');
        }
    };

    const isPastAppointment = (apt: Appointment) => {
        const aptDate = new Date(apt.appointment_date);
        aptDate.setHours(0, 0, 0, 0);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return aptDate < now || apt.status === 'completed' || apt.status === 'cancelled';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'scheduled': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            case 'no-show': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
            default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
        }
    };

    if (loading) {
        return (
            <div className="pt-8 flex justify-center items-center min-h-96">
                <MedicalLoader message="Syncing clinical appointments..." />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <TransitionItem className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="page-heading !mb-0 transition-all duration-300">My Appointments</h1>
                    <p className="page-subheading italic">View and manage your appointments</p>
                </div>
                <Button
                    variant="default"
                    className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:brightness-110 shadow-lg shadow-teal-900/20 border-0 transition-all duration-300"
                    onClick={() => navigate('/book-appointment')}
                >
                    <Plus className="h-5 w-5" />
                    Book New
                </Button>
            </TransitionItem>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Filters */}
            <TransitionItem className="flex flex-wrap gap-3 p-2 bg-muted/50 rounded-lg border">
                <button
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${filter === 'all'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-background hover:text-foreground'
                        }`}
                    onClick={() => setFilter('all')}
                >
                    All ({appointments.length})
                </button>
                <button
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${filter === 'upcoming'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-background hover:text-foreground'
                        }`}
                    onClick={() => setFilter('upcoming')}
                >
                    Upcoming ({appointments.filter(a => new Date(a.appointment_date) >= new Date() && a.status !== 'cancelled').length})
                </button>
                <button
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${filter === 'past'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-background hover:text-foreground'
                        }`}
                    onClick={() => setFilter('past')}
                >
                    Past ({appointments.filter(a => new Date(a.appointment_date) < new Date() || a.status === 'completed' || a.status === 'cancelled').length})
                </button>
            </TransitionItem>

            {/* Appointments List */}
            <TransitionItem className="grid gap-4">
                {filteredAppointments.length === 0 ? (
                    <Card className="p-12 text-center flex flex-col items-center justify-center space-y-4">
                        <CalendarX className="h-16 w-16 text-muted-foreground/30" />
                        <p className="text-muted-foreground text-lg">
                            No {filter === 'all' ? '' : filter} appointments found
                        </p>
                        <Button
                            variant="default"
                            onClick={() => navigate('/book-appointment')}
                            className="mt-4"
                        >
                            Book Your First Appointment
                        </Button>
                    </Card>
                ) : (
                    filteredAppointments.map((appointment) => (
                        <Card key={appointment.id} className="group hover:shadow-md transition-all duration-200">
                            <div className="p-6 flex flex-col md:flex-row gap-6">
                                {/* Date Badge */}
                                <div className="flex-shrink-0 w-16 h-16 bg-primary/10 rounded-xl flex flex-col items-center justify-center text-primary border border-primary/20">
                                    <span className="text-2xl font-bold leading-none">
                                        {new Date(appointment.appointment_date).getDate()}
                                    </span>
                                    <span className="text-xs font-semibold uppercase mt-1">
                                        {new Date(appointment.appointment_date).toLocaleDateString('en-US', { month: 'short' })}
                                    </span>
                                </div>

                                {/* Main Content */}
                                <div className="flex-1 space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <h3 className="font-semibold text-lg flex items-center gap-3">
                                                {user?.role === 'doctor' ? appointment.other_party_name || 'Patient' : appointment.other_party_name || 'Doctor'}
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${getStatusColor(appointment.status)}`}>
                                                    {appointment.status}
                                                </span>
                                            </h3>
                                            <p className="text-muted-foreground">{appointment.reason}</p>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex flex-row sm:flex-col md:flex-row gap-2 items-center">
                                            {/* Doctor: Mark Complete */}
                                            {appointment.status === 'scheduled' && user?.role === 'doctor' && (
                                                <Button
                                                    variant="default"
                                                    size="sm"
                                                    onClick={() => handleComplete(appointment.id)}
                                                >
                                                    Mark Complete
                                                </Button>
                                            )}

                                            {/* Patient: Cancel (upcoming/scheduled only) */}
                                            {appointment.status === 'scheduled' && user?.role === 'patient' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleCancel(appointment.id)}
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                                                >
                                                    Cancel
                                                </Button>
                                            )}

                                            {/* Patient: Delete (past/completed/cancelled only) */}
                                            {user?.role === 'patient' && isPastAppointment(appointment) && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => handleDelete(e, appointment.id)}
                                                    className="
                                                        gap-1.5 font-medium text-sm
                                                        text-rose-600 hover:text-rose-700
                                                        hover:bg-rose-50
                                                        dark:text-rose-400 dark:hover:text-rose-300
                                                        dark:hover:bg-rose-950/40
                                                        border border-rose-200 hover:border-rose-300
                                                        dark:border-rose-800/60 dark:hover:border-rose-700
                                                        transition-all duration-150
                                                    "
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    Delete
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Details Grid */}
                                    <div className="flex flex-wrap gap-6 text-sm text-muted-foreground pt-2 border-t border-border/50">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-primary/60" />
                                            <span>{new Date(`2000-01-01T${appointment.appointment_time}`).toLocaleTimeString('en-US', {
                                                hour: 'numeric',
                                                minute: '2-digit',
                                                hour12: true
                                            })}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-primary/60" />
                                            <span>{new Date(appointment.appointment_date).toLocaleDateString('en-US', {
                                                weekday: 'long',
                                                month: 'long',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </TransitionItem>
        </div>
    );
};
