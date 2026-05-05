import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useConfirm } from '@/hooks/use-confirm';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    getMyAppointments,
    cancelAppointment,
    updateAppointmentStatus,
    deleteAppointment,
    archiveAppointmentForDoctor,
} from '../../services/appointment.service';
import type { Appointment } from '../../services/appointment.service';
import {
    Plus,
    AlertCircle,
    CalendarX,
    Clock,
    Calendar,
    Trash2,
    CheckCircle2,
    UserX,
    Archive,
} from 'lucide-react';
import { MedicalLoader } from '@/components/ui/medical-loader';
import { TablePagination } from '@/components/ui/table-pagination';

import { TransitionItem } from '../../components/layout/page-transition';
import { getErrorMessage } from '../../lib/error';
import { socketService } from '../../services/socket.service';
import { logger } from '@/utils/logger';
import {
    AppointmentOverdueEventSchema,
    type AppointmentOverdueEvent,
} from '../../../../shared/schemas/admin-events.schema';

import { PATHS } from '../../routes/paths';

/**
 * 🩺 Doctor-side appointment lifecycle (rationale)
 *
 * The state machine the UI exposes is:
 *
 *   scheduled (future / on-time)
 *      → doctor sees: [Mark Complete]   (single action — happy path)
 *
 *   scheduled (≥ 15 min past start, no doctor decision yet)
 *      → backend cron emits `appointment:overdue`
 *      → row tints amber, shows "Awaiting patient · Nm late" pill
 *      → doctor sees: [Mark Complete] [Mark No-Show]
 *      → toast surfaces ONCE per overdue event for any tab open at the time
 *
 *   terminal (completed / cancelled / no-show)
 *      → doctor sees: [Archive]   (soft-hide for THIS doctor only;
 *                                  patient view + audit trail unaffected)
 *
 * Patient-side flows (Cancel before, Delete after) are unchanged.
 *
 * Auto-flipping a `scheduled` row to `no-show` is explicitly NOT done.
 * Transferring that decision from the doctor (manual clinical judgment)
 * to the platform (automated) is a known anti-pattern in scheduling
 * systems — we nudge with a visual tint + non-blocking toast and let
 * the doctor decide.
 */
const OVERDUE_GRACE_MINUTES = 15;

function isOverdueScheduled(apt: Appointment, nowMs: number): boolean {
    if (apt.status !== 'scheduled') return false;
    const startMs = new Date(`${apt.appointmentDate}T${apt.appointmentTime}`).getTime();
    if (!Number.isFinite(startMs)) return false;
    return nowMs - startMs >= OVERDUE_GRACE_MINUTES * 60_000;
}

function minutesLateOf(apt: Appointment, nowMs: number): number {
    const startMs = new Date(`${apt.appointmentDate}T${apt.appointmentTime}`).getTime();
    if (!Number.isFinite(startMs)) return 0;
    return Math.max(0, Math.floor((nowMs - startMs) / 60_000));
}

export const Appointments: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const applyFilter = useCallback(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        let filtered = appointments;

        if (filter === 'upcoming') {
            filtered = appointments.filter(apt => {
                const aptDate = new Date(apt.appointmentDate);
                aptDate.setHours(0, 0, 0, 0);
                return aptDate >= now && apt.status !== 'cancelled';
            });
        } else if (filter === 'past') {
            filtered = appointments.filter(apt => {
                const aptDate = new Date(apt.appointmentDate);
                aptDate.setHours(0, 0, 0, 0);
                return aptDate < now || apt.status === 'completed' || apt.status === 'cancelled';
            });
        }

        setFilteredAppointments(filtered);
        setCurrentPage(1); // Reset to first page on filter change
    }, [appointments, filter]);

    useEffect(() => {
        fetchAppointments();
    }, []);

    useEffect(() => {
        applyFilter();
    }, [filter, appointments, applyFilter]);

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            const data = await getMyAppointments({});
            setAppointments(data);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load appointments'));
        } finally {
            setLoading(false);
        }
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
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to cancel appointment'));
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
            window.dispatchEvent(new CustomEvent('system:success', {
                detail: { message: 'Appointment marked as complete.' },
            }));
            await fetchAppointments();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to update appointment'));
        }
    };

    const handleNoShow = async (appointmentId: number) => {
        const isConfirmed = await confirm({
            title: 'Mark as No-Show',
            message:
                'Confirm that the patient did not arrive for this appointment. This is a clinical record and cannot be undone from this view.',
            type: 'warning',
            confirmText: 'Mark No-Show',
            cancelText: 'Cancel',
        });
        if (!isConfirmed) return;

        try {
            await updateAppointmentStatus(appointmentId, 'no-show');
            window.dispatchEvent(new CustomEvent('system:success', {
                detail: { message: 'Appointment marked as no-show.' },
            }));
            await fetchAppointments();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to update appointment'));
        }
    };

    const handleArchive = async (appointmentId: number) => {
        const isConfirmed = await confirm({
            title: 'Archive Appointment',
            message:
                'Archive this appointment from your list? The patient will still see it in their history; only your view is affected.',
            type: 'warning',
            confirmText: 'Archive',
            cancelText: 'Cancel',
        });
        if (!isConfirmed) return;

        try {
            await archiveAppointmentForDoctor(appointmentId);
            setAppointments(prev => prev.filter(a => a.id !== appointmentId));
            window.dispatchEvent(new CustomEvent('system:success', {
                detail: { message: 'Appointment archived from your list.' },
            }));
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to archive appointment'));
        }
    };

    const isPastAppointment = (apt: Appointment) => {
        const aptDate = new Date(apt.appointmentDate);
        aptDate.setHours(0, 0, 0, 0);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return aptDate < now || apt.status === 'completed' || apt.status === 'cancelled';
    };

    // Tick once per minute so the "Nm late" pill text refreshes without a
    // re-fetch. The minute granularity matches the precision of the pill
    // itself — sub-minute ticks would just churn the render tree.
    const [nowMs, setNowMs] = useState<number>(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
        return () => window.clearInterval(id);
    }, []);

    // Doctor-only: subscribe to backend `appointment:overdue` events. The
    // backend cron stamps `overdue_notified_at` once per row, so each row
    // produces at most one event per overdue cycle. We surface a non-blocking
    // warning toast and rely on the local `isOverdueScheduled` time check
    // for the visual tint (so doctors who load the page mid-overdue still
    // see the amber state, even if they missed the live socket event).
    const isDoctor = user?.role === 'doctor';
    useEffect(() => {
        if (!isDoctor) return;

        const handler = (raw: AppointmentOverdueEvent): void => {
            const parsed = AppointmentOverdueEventSchema.safeParse(raw);
            if (!parsed.success) {
                logger.error('[Appointments] appointment:overdue payload validation failed', {
                    issues: JSON.stringify(parsed.error.issues),
                });
                return;
            }
            const ev = parsed.data;
            const patient = ev.patientName ?? 'A patient';
            window.dispatchEvent(new CustomEvent('system:warning', {
                detail: {
                    message: `${patient} is ${ev.minutesLate}m late — review the appointment to mark complete or no-show.`,
                },
            }));
            // Force a tick refresh so the row picks up its overdue tint
            // immediately, without waiting on the 30s cadence above.
            setNowMs(Date.now());
        };

        socketService.on('appointment:overdue', handler);
        return () => {
            socketService.off('appointment:overdue', handler);
        };
    }, [isDoctor]);

    const overdueIdSet = useMemo<ReadonlySet<number>>(() => {
        const ids = new Set<number>();
        if (!isDoctor) return ids;
        for (const apt of appointments) {
            if (isOverdueScheduled(apt, nowMs)) ids.add(apt.id);
        }
        return ids;
    }, [appointments, nowMs, isDoctor]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'scheduled': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            case 'no-show': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
            default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
        }
    };

    // Calculate pagination
    const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredAppointments.length);
    const paginatedAppointments = filteredAppointments.slice(startIndex, endIndex);

    if (loading) {
        return <MedicalLoader message="Syncing clinical appointments..." />;
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
                    onClick={() => navigate(PATHS.PATIENT.BOOK_APPOINTMENT)}
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
            <TransitionItem className="flex flex-wrap gap-3 p-2 bg-muted/50 rounded-[var(--card-radius)] border">
                <button
                    className={`px-4 py-2 text-sm font-medium rounded-[var(--card-radius)] transition-all ${filter === 'all'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-background hover:text-foreground'
                        }`}
                    onClick={() => setFilter('all')}
                >
                    All ({appointments.length})
                </button>
                <button
                    className={`px-4 py-2 text-sm font-medium rounded-[var(--card-radius)] transition-all ${filter === 'upcoming'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-background hover:text-foreground'
                        }`}
                    onClick={() => setFilter('upcoming')}
                >
                    Upcoming ({appointments.filter(a => new Date(a.appointmentDate) >= new Date() && a.status !== 'cancelled').length})
                </button>
                <button
                    className={`px-4 py-2 text-sm font-medium rounded-[var(--card-radius)] transition-all ${filter === 'past'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-background hover:text-foreground'
                        }`}
                    onClick={() => setFilter('past')}
                >
                    Past ({appointments.filter(a => new Date(a.appointmentDate) < new Date() || a.status === 'completed' || a.status === 'cancelled').length})
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
                            onClick={() => navigate(PATHS.PATIENT.BOOK_APPOINTMENT)}
                            className="mt-4"
                        >
                            Book Your First Appointment
                        </Button>
                    </Card>
                ) : (
                    paginatedAppointments.map((appointment) => {
                        const isOverdue = overdueIdSet.has(appointment.id);
                        const isTerminalForDoctor = isDoctor && (
                            appointment.status === 'completed'
                            || appointment.status === 'cancelled'
                            || appointment.status === 'no-show'
                        );
                        const cardOverdueClass = isOverdue ? 'appointment-card-overdue' : '';
                        return (
                        <Card
                            key={appointment.id}
                            className={`group hover:shadow-md transition-all duration-200 ${cardOverdueClass}`.trim()}
                        >
                            <div className="p-6 flex flex-col md:flex-row gap-6">
                                {/* Date Badge */}
                                <div className="flex-shrink-0 w-16 h-16 bg-primary/10 rounded-[var(--card-radius)] flex flex-col items-center justify-center text-primary border border-primary/20">
                                    <span className="text-2xl font-bold leading-none">
                                        {new Date(appointment.appointmentDate).getDate()}
                                    </span>
                                    <span className="text-xs font-semibold uppercase mt-1">
                                        {new Date(appointment.appointmentDate).toLocaleDateString('en-US', { month: 'short' })}
                                    </span>
                                </div>

                                {/* Main Content */}
                                <div className="flex-1 space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <h3 className="font-semibold text-lg flex items-center gap-3 flex-wrap">
                                                {user?.role === 'doctor' ? appointment.otherPartyName || 'Patient' : appointment.otherPartyName || 'Doctor'}
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${getStatusColor(appointment.status)}`}>
                                                    {appointment.status}
                                                </span>
                                                {isOverdue && (
                                                    <span
                                                        className="appointment-awaiting-pill"
                                                        aria-label={`Patient awaiting — ${minutesLateOf(appointment, nowMs)} minutes late`}
                                                    >
                                                        <span className="appointment-awaiting-pill__dot" aria-hidden="true" />
                                                        Awaiting patient · {minutesLateOf(appointment, nowMs)}m late
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-muted-foreground">{appointment.reason}</p>
                                        </div>

                                        {/* Action Buttons — exactly ONE state at a time so the doctor
                                            never sees a clutter of overlapping CTAs. State machine:
                                              scheduled (on-time)  → [Mark Complete]
                                              scheduled (overdue)  → [Mark Complete] [Mark No-Show]
                                              terminal             → [Archive]
                                        */}
                                        <div className="flex flex-row sm:flex-col md:flex-row gap-2 items-center">
                                            {/* Doctor: Mark Complete (always for scheduled) */}
                                            {appointment.status === 'scheduled' && isDoctor && (
                                                <Button
                                                    variant="default"
                                                    size="sm"
                                                    onClick={() => handleComplete(appointment.id)}
                                                    className="gap-1.5"
                                                >
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    Mark Complete
                                                </Button>
                                            )}

                                            {/* Doctor: Mark No-Show (only when scheduled + overdue) */}
                                            {appointment.status === 'scheduled' && isDoctor && isOverdue && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleNoShow(appointment.id)}
                                                    className="appointment-noshow-btn gap-1.5 font-medium text-sm"
                                                >
                                                    <UserX className="h-3.5 w-3.5" />
                                                    Mark No-Show
                                                </Button>
                                            )}

                                            {/* Doctor: Archive (terminal states only — soft-hide for THIS doctor,
                                                preserves patient view + audit trail) */}
                                            {isTerminalForDoctor && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleArchive(appointment.id)}
                                                    className="
                                                        gap-1.5 font-medium text-sm
                                                        text-muted-foreground hover:text-foreground
                                                        hover:bg-muted
                                                        border border-border hover:border-foreground/30
                                                        transition-all duration-150
                                                    "
                                                >
                                                    <Archive className="h-3.5 w-3.5" />
                                                    Archive
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
                                            <span>{new Date(`2000-01-01T${appointment.appointmentTime}`).toLocaleTimeString('en-US', {
                                                hour: 'numeric',
                                                minute: '2-digit',
                                                hour12: true
                                            })}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-primary/60" />
                                            <span>{new Date(appointment.appointmentDate).toLocaleDateString('en-US', {
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
                        );
                    })
                )}
                <TablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredAppointments.length}
                    startIndex={startIndex}
                    endIndex={endIndex}
                    showPagination={totalPages > 1}
                    onPageChange={setCurrentPage}
                    itemLabel="appointments"
                />
            </TransitionItem>
        </div>
    );
};
