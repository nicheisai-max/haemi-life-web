import React, { useEffect, useState, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AnimatedAlert } from '@/components/ui/animated-alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
    getDoctorSchedule,
    updateDoctorSchedule,
    updateClinicTimezone,
} from '../../services/doctor.service';
import { Save, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { PremiumLoader } from '@/components/ui/premium-loader';
import { usePageLoader } from '@/hooks/use-page-loader';
import { PremiumTimePicker } from '@/components/ui/premium-time-picker';
import { ClinicTimezoneCard } from '@/components/ui/clinic-timezone-card';
import { useClinicTimezone } from '@/hooks/use-clinic-timezone';
import { logger } from '@/utils/logger';
import { doctorScheduleSchema, type FullDoctorScheduleFormData } from '../../lib/validation/schedule.schema';
import { dispatchClinicTimezoneUpdated } from '@/utils/clinic-timezone-events';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DoctorScheduleManagement: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Phase 4c — Timezone Sovereignty. The doctor's authoritative
    // clinic timezone now lives in `<ClinicTimezoneProvider>` at the
    // clinical-layout boundary, so this page is a CONSUMER (reads
    // `clinicTimezone`) and a PRODUCER (dispatches updates via
    // `dispatchClinicTimezoneUpdated()` — the provider hears them and
    // updates context for every other surface). The Phase 2 backend
    // contract is unchanged: existing appointments are UTC-anchored,
    // only NEW slot computations follow the updated value.
    const { clinicTimezone } = useClinicTimezone();
    const [tzUpdating, setTzUpdating] = useState<boolean>(false);

    const form = useForm<FullDoctorScheduleFormData>({
        resolver: zodResolver(doctorScheduleSchema),
        defaultValues: {
            schedule: DAYS_OF_WEEK.map((_, index) => ({
                dayOfWeek: index,
                startTime: '09:00',
                endTime: '17:00',
                isAvailable: false,
            })),
        },
    });

    // Re-wrapping with a single schema for the array if needed, but let's see.
    // The previous schema was just the array. useForm expects an object.
    // I'll wrap it in an object for useForm.

    const { fields } = useFieldArray({
        control: form.control,
        name: "schedule",
    });

    const fetchSchedule = useCallback(async () => {
        try {
            setLoading(true);
            // Phase 4c: the clinic timezone is hydrated centrally by
            // <ClinicTimezoneProvider>, so this fetch only loads the
            // schedule rows — one fewer profile round-trip per page
            // load.
            const data = await getDoctorSchedule();

            // Map data to ensure all days are present
            const fullSchedule = DAYS_OF_WEEK.map((_, index) => {
                const existing = data.find(s => s.dayOfWeek === index);
                return existing ? {
                    dayOfWeek: existing.dayOfWeek,
                    startTime: existing.startTime.substring(0, 5), // Ensure HH:mm format
                    endTime: existing.endTime.substring(0, 5),
                    isAvailable: existing.isAvailable
                } : {
                    dayOfWeek: index,
                    startTime: '09:00',
                    endTime: '17:00',
                    isAvailable: false
                };
            });

            form.reset({ schedule: fullSchedule });
        } catch (err: unknown) {
            const apiErr = err as { response?: { data?: { message?: string } } };
            setError(apiErr.response?.data?.message || 'Failed to load schedule');
        } finally {
            setLoading(false);
        }
    }, [form]);

    useEffect(() => {
        fetchSchedule();
    }, [fetchSchedule]);

    /**
     * Persist a new clinic timezone. Optimistic UI: we set the local
     * value before the network round-trip so the card reflects the
     * pick instantly, and roll back to the previous value if the
     * server rejects it. The server is the authority for IANA
     * validation (Phase 2 controller); on a 4xx the server message is
     * surfaced verbatim so the doctor sees what failed.
     *
     * Feedback channel: the same inline `<Alert />` banners that the
     * schedule-save flow uses. Avoids the dual-feedback inconsistency
     * (toast + inline alert) the page previously had, and keeps the
     * doctor's eyes on a single canonical surface for "did my change
     * stick?" — exactly per QA review (2026-05-10).
     */
    /**
     * Persist a new clinic timezone — the producer side of the
     * Phase 4c sync architecture.
     *
     * Flow (optimistic, dispatch-driven):
     *   1. Snapshot `previous` from context so we can roll back.
     *   2. Optimistic broadcast `dispatchClinicTimezoneUpdated(next)`
     *      → `<ClinicTimezoneProvider>` hears it instantly, updates
     *      context, every consumer (this card included) re-renders
     *      with `next`. Doctor sees an immediate UI change.
     *   3. Network round-trip to `updateClinicTimezone(next)`.
     *   4. On success: rebroadcast with `result.clinicTimezone` (the
     *      server's canonical echo) — covers any IANA aliasing the
     *      backend applies (e.g. `Asia/Calcutta` → `Asia/Kolkata`).
     *   5. On failure: rebroadcast with `previous` → context rolls
     *      back, every consumer re-renders with the old value.
     *
     * The same broadcast that updates this page's `<ClinicTimezoneCard>`
     * also propagates to the patient-list card hover, the dashboard
     * widgets, and to OTHER browser tabs via `BroadcastChannel` (see
     * `clinic-timezone-events.ts`). No duplicate local state, no
     * stale-tab problem.
     */
    const handleTimezoneChange = useCallback(async (next: string): Promise<void> => {
        const previous: string = clinicTimezone;
        setTzUpdating(true);
        setError(null);
        setSuccess(null);

        // Optimistic UI — the provider's broadcast listener flips
        // every consumer to `next` immediately, before the network
        // call resolves.
        dispatchClinicTimezoneUpdated(next);

        try {
            const result = await updateClinicTimezone(next);
            // Server's canonical echo — covers IANA aliasing
            // (`Asia/Calcutta` → `Asia/Kolkata`). Re-dispatch only if
            // it differs from our optimistic value, otherwise the
            // listeners no-op anyway.
            if (result.clinicTimezone !== next) {
                dispatchClinicTimezoneUpdated(result.clinicTimezone);
            }
            setSuccess(`Clinic timezone updated to ${result.clinicTimezone}`);
            window.setTimeout(() => setSuccess(null), 3000);
        } catch (err: unknown) {
            // Roll back every consumer (this page included) to the
            // pre-mutation value via the same broadcast channel.
            dispatchClinicTimezoneUpdated(previous);
            const apiErr = err as { response?: { data?: { message?: string } } };
            const message: string = apiErr.response?.data?.message ?? 'Failed to update clinic timezone';
            setError(message);
            logger.error('[Schedule] Clinic timezone update failed', {
                attempted: next,
                error: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setTzUpdating(false);
        }
    }, [clinicTimezone]);

    const onSubmit = async (data: FullDoctorScheduleFormData) => {
        try {
            setError(null);
            setSuccess(null);

            await updateDoctorSchedule(data.schedule);
            setSuccess('Schedule updated successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: unknown) {
            const apiErr = err as { response?: { data?: { message?: string } } };
            setError(apiErr.response?.data?.message || 'Failed to update schedule');
        }
    };

    usePageLoader(loading, 'Synchronizing clinical calendar...');
    if (loading) return null;

    return (<div className="space-y-8">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="page-heading">Schedule Management</h1>
                        <p className="page-subheading">Configure your weekly availability for patient appointments</p>
                    </div>
                    <Button
                        type="submit"
                        disabled={form.formState.isSubmitting}
                        className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:brightness-110 shadow-lg shadow-teal-900/20 border-0 transition-all duration-300 min-w-[140px]"
                    >
                        {form.formState.isSubmitting ? (
                            <>
                                <PremiumLoader size="xs" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Schedule
                            </>
                        )}
                    </Button>
                </div>

                <AnimatedAlert visible={error !== null}>
                    <Alert variant="destructive">
                        <div className="flex-shrink-0 flex items-center justify-center">
                            <AlertCircle className="h-4 w-4" />
                        </div>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </AnimatedAlert>

                <AnimatedAlert visible={success !== null}>
                    <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                        <div className="flex-shrink-0 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <AlertDescription>{success}</AlertDescription>
                    </Alert>
                </AnimatedAlert>

                <ClinicTimezoneCard
                    value={clinicTimezone}
                    onChange={handleTimezoneChange}
                    isUpdating={tzUpdating}
                />

                <Card className="p-6">
                    <div className="space-y-4">
                        {fields.map((field, index) => {
                            const isAvailable = form.watch(`schedule.${index}.isAvailable`);

                            return (
                                <div
                                    key={field.id}
                                    className={`flex flex-col md:flex-row items-center justify-between p-4 rounded-[var(--card-radius)] border transition-all duration-200 ${isAvailable
                                        ? 'bg-card border-border shadow-sm'
                                        : 'bg-muted/30 border-transparent opacity-80 hover:opacity-100'
                                        }`}
                                >
                                    <div className="flex items-center gap-4 w-full md:w-48 mb-4 md:mb-0">
                                        <FormField
                                            control={form.control}
                                            name={`schedule.${index}.isAvailable`}
                                            render={({ field }) => (
                                                <FormItem className="flex items-center space-x-3 space-y-0">
                                                    <FormControl>
                                                        <Switch
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className={`text-base font-medium cursor-pointer ${field.value ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                        {DAYS_OF_WEEK[index]}
                                                    </FormLabel>
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    {isAvailable ? (
                                        <div className="flex items-center gap-3 flex-1 w-full md:w-auto">
                                            <div className="grid grid-cols-2 gap-3 w-full md:w-auto md:flex md:items-center">
                                                <FormField
                                                    control={form.control}
                                                    name={`schedule.${index}.startTime`}
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-1">
                                                            <FormLabel className="text-xs text-muted-foreground font-medium md:hidden">Start</FormLabel>
                                                            <FormControl>
                                                                <PremiumTimePicker
                                                                    value={field.value}
                                                                    onChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <div className="flex items-center justify-center md:hidden">
                                                    <span className="text-muted-foreground text-sm">to</span>
                                                </div>
                                                <span className="hidden md:block text-muted-foreground text-sm px-2">to</span>

                                                <FormField
                                                    control={form.control}
                                                    name={`schedule.${index}.endTime`}
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-1">
                                                            <FormLabel className="text-xs text-muted-foreground font-medium md:hidden">End</FormLabel>
                                                            <FormControl>
                                                                <PremiumTimePicker
                                                                    value={field.value}
                                                                    onChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 text-center md:text-left md:pl-4">
                                            <span className="text-sm text-muted-foreground italic">Unavailable</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </Card>

                <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800">
                    <div className="p-6 flex flex-col sm:flex-row gap-4">
                        <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 h-fit">
                            <Info className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-blue-900 dark:text-blue-100">Schedule Guidelines</h3>
                            <ul className="text-sm text-blue-800/80 dark:text-blue-200/80 space-y-1.5 list-disc pl-4 pt-2">
                                <li>Toggle days on/off to set your availability for that specific day of the week.</li>
                                <li>Set start and end times for each available day in 24-hour format.</li>
                                <li>Appointments will only be bookable by patients during these hours.</li>
                                <li>Changes take effect immediately after clicking "Save Schedule".</li>
                            </ul>
                        </div>
                    </div>
                </Card>
            </form>
        </Form>
    </div>);
};
