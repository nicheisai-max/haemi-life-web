import React, { useEffect, useState, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { getDoctorSchedule, updateDoctorSchedule } from '../../services/doctor.service';
import { Save, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { PremiumLoader } from '@/components/ui/premium-loader';
import { MedicalLoader } from '@/components/ui/medical-loader';
import { PremiumTimePicker } from '@/components/ui/premium-time-picker';
import { doctorScheduleSchema, type FullDoctorScheduleFormData } from '../../lib/validation/schedule.schema';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DoctorScheduleManagement: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const form = useForm<FullDoctorScheduleFormData>({
        resolver: zodResolver(doctorScheduleSchema),
        defaultValues: {
            schedule: DAYS_OF_WEEK.map((_, index) => ({
                day_of_week: index,
                start_time: '09:00',
                end_time: '17:00',
                is_available: false,
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
            const data = await getDoctorSchedule();

            // Map data to ensure all days are present
            const fullSchedule = DAYS_OF_WEEK.map((_, index) => {
                const existing = data.find(s => s.day_of_week === index);
                return existing ? {
                    day_of_week: existing.day_of_week,
                    start_time: existing.start_time.substring(0, 5), // Ensure HH:mm format
                    end_time: existing.end_time.substring(0, 5),
                    is_available: existing.is_available
                } : {
                    day_of_week: index,
                    start_time: '09:00',
                    end_time: '17:00',
                    is_available: false
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

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <MedicalLoader message="Synchronizing clinical calendar..." />
            </div>
        );
    }

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

                {error && (
                    <Alert variant="destructive">
                        <div className="flex-shrink-0 flex items-center justify-center">
                            <AlertCircle className="h-4 w-4" />
                        </div>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {success && (
                    <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                        <div className="flex-shrink-0 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <AlertDescription>{success}</AlertDescription>
                    </Alert>
                )}

                <Card className="p-6">
                    <div className="space-y-4">
                        {fields.map((field, index) => {
                            const isAvailable = form.watch(`schedule.${index}.is_available`);

                            return (
                                <div
                                    key={field.id}
                                    className={`flex flex-col md:flex-row items-center justify-between p-4 rounded-xl border transition-all duration-200 ${isAvailable
                                        ? 'bg-card border-border shadow-sm'
                                        : 'bg-muted/30 border-transparent opacity-80 hover:opacity-100'
                                        }`}
                                >
                                    <div className="flex items-center gap-4 w-full md:w-48 mb-4 md:mb-0">
                                        <FormField
                                            control={form.control}
                                            name={`schedule.${index}.is_available`}
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
                                                    name={`schedule.${index}.start_time`}
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
                                                    name={`schedule.${index}.end_time`}
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
