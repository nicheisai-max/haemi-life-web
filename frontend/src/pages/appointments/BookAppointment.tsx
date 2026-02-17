import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { getDoctors } from '../../services/doctor.service';
import { bookAppointment, getAvailableSlots } from '../../services/appointment.service';
import { bookAppointmentSchema, type BookAppointmentFormData } from '../../lib/validation/appointment.schema';
import type { DoctorProfile } from '../../services/doctor.service';
import type { AvailableSlots } from '../../services/appointment.service';
import { CheckCircle, AlertTriangle, User, Calendar, Clock } from 'lucide-react';
import { Loader } from '@/components/ui/Loader';
import { DateScroller } from '@/components/ui/DateScroller';
import { TimeGrid } from '@/components/ui/TimeGrid';
import { motion, AnimatePresence } from 'framer-motion';

export const BookAppointment: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const preselectedDoctorId = searchParams.get('doctorId');

    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [availableSlots, setAvailableSlots] = useState<AvailableSlots | null>(null);
    const [loading, setLoading] = useState(true);
    const [generalError, setGeneralError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const form = useForm<z.input<typeof bookAppointmentSchema>, undefined, BookAppointmentFormData>({
        resolver: zodResolver(bookAppointmentSchema),
        defaultValues: {
            doctor_id: '',
            appointment_date: '',
            appointment_time: '',
            consultation_type: 'in-person',
            reason: '',
        },
    });

    const watchedDoctorId = form.watch('doctor_id');
    const watchedDate = form.watch('appointment_date');

    useEffect(() => {
        fetchDoctors();
    }, []);

    useEffect(() => {
        if (preselectedDoctorId && doctors.length > 0) {
            form.setValue('doctor_id', preselectedDoctorId);
        }
    }, [preselectedDoctorId, doctors]);

    useEffect(() => {
        if (watchedDoctorId && watchedDate) {
            fetchAvailableSlots();
        }
    }, [watchedDoctorId, watchedDate]);

    const fetchDoctors = async () => {
        try {
            setLoading(true);
            const data = await getDoctors();
            setDoctors(data);
        } catch (err: any) {
            setGeneralError(err.response?.data?.message || 'Failed to load doctors');
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableSlots = async () => {
        try {
            const doctorId = watchedDoctorId as string;
            if (!doctorId) return;

            const slots = await getAvailableSlots(doctorId, watchedDate);
            setAvailableSlots(slots);
        } catch (err: any) {
            console.error('Failed to fetch slots:', err);
            setAvailableSlots(null);
        }
    };

    const onSubmit = async (data: BookAppointmentFormData) => {
        try {
            setGeneralError(null);
            await bookAppointment(data);
            setSuccess(true);
            setTimeout(() => {
                navigate('/appointments');
            }, 2000);
        } catch (err: any) {
            setGeneralError(err.response?.data?.message || 'Failed to book appointment');
        }
    };

    const selectedDoctorData = doctors.find(d => d.id === watchedDoctorId);


    if (success) {
        return (
            <div className="container mx-auto p-4 md:p-8 max-w-7xl flex items-center justify-center min-h-[50vh]">
                <Card className="p-12 text-center max-w-lg w-full">
                    <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-6" />
                    <h2 className="text-2xl font-bold text-foreground mb-2">Appointment Booked!</h2>
                    <p className="text-muted-foreground mb-4">Your appointment has been successfully scheduled.</p>
                    <p className="text-sm text-muted-foreground">Redirecting to appointments...</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-7xl animate-in fade-in duration-500">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">Book Appointment</h1>
                <p className="text-muted-foreground text-lg">Schedule a consultation with a healthcare professional</p>
            </div>

            {generalError && (
                <div className="bg-destructive/15 border border-destructive text-destructive p-4 rounded-lg flex items-center gap-3 mb-6">
                    <AlertTriangle className="h-5 w-5" />
                    {generalError}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8 min-w-0">
                {/* Booking Form */}
                <div className="min-w-0">
                    <Card className="p-8 h-fit border-none shadow-xl shadow-primary/5 bg-background/50 backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border/40">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <Calendar className="h-5 w-5" />
                            </div>
                            <h2 className="text-xl font-bold text-foreground">Appointment Details</h2>
                        </div>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="doctor_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Select Doctor</FormLabel>
                                            <Select
                                                onValueChange={(value) => field.onChange(value)}
                                                value={field.value || ''}
                                                disabled={loading}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Choose a doctor..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {doctors.map(doctor => (
                                                        <SelectItem key={doctor.id} value={doctor.id.toString()}>
                                                            {doctor.name} - {doctor.specialization}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="appointment_date"
                                    render={({ field }) => (
                                        <FormItem className="space-y-4">
                                            <div className="space-y-1">
                                                <FormLabel className="text-base font-bold text-foreground">Select Appointment Date</FormLabel>
                                                <p className="text-xs text-muted-foreground">Choose a convenient date for your consultation</p>
                                            </div>
                                            <FormControl>
                                                <DateScroller
                                                    selectedDate={field.value}
                                                    onDateSelect={field.onChange}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <AnimatePresence>
                                    {watchedDate && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-4 pt-6 border-t border-border/40"
                                        >
                                            <FormField
                                                control={form.control}
                                                name="appointment_time"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-4">
                                                        <div className="space-y-1">
                                                            <FormLabel className="text-base font-bold text-foreground">Choose Available Time</FormLabel>
                                                            <p className="text-xs text-muted-foreground">Select an available slot from the groups below</p>
                                                        </div>
                                                        <FormControl>
                                                            <TimeGrid
                                                                slots={availableSlots?.slots || []}
                                                                selectedTime={field.value}
                                                                onTimeSelect={field.onChange}
                                                                loading={loading}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <FormField
                                    control={form.control}
                                    name="consultation_type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Consultation Type</FormLabel>
                                            <Select
                                                onValueChange={(value) => field.onChange(value)}
                                                value={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select type..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="in-person">In-Person (Physical)</SelectItem>
                                                    <SelectItem value="video">Online (Video Call)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="reason"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Reason for Visit</FormLabel>
                                            <FormControl>
                                                <textarea
                                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    rows={4}
                                                    placeholder="Describe your symptoms or reason for visit..."
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button
                                    type="submit"
                                    className="w-full"
                                    size="lg"
                                    disabled={form.formState.isSubmitting}
                                >
                                    {form.formState.isSubmitting ? (
                                        <>
                                            <Loader size="xs" className="mr-2" />
                                            Booking...
                                        </>
                                    ) : (
                                        <>
                                            <Calendar className="mr-2 h-4 w-4" />
                                            Book Appointment
                                        </>
                                    )}
                                </Button>
                            </form>
                        </Form>
                    </Card>
                </div>

                {/* Info / Summary Card */}
                {selectedDoctorData && (
                    <div className="space-y-6">
                        <Card className="p-6 sticky top-24">
                            <h2 className="text-lg font-semibold text-foreground mb-6 pb-4 border-b">Appointment Summary</h2>

                            <div className="mb-6 pb-6 border-b last:border-0 last:pb-0 last:mb-0">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Doctor</h3>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <User className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-foreground">{selectedDoctorData.name}</div>
                                        <div className="text-sm text-primary">{selectedDoctorData.specialization}</div>
                                    </div>
                                </div>
                            </div>

                            {watchedDate && (
                                <div className="mb-6 pb-6 border-b last:border-0 last:pb-0 last:mb-0">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Date & Time</h3>
                                    <div className="flex items-center gap-3 text-sm text-foreground mb-2">
                                        <Calendar className="h-5 w-5 text-muted-foreground" />
                                        <span>{new Date(watchedDate).toLocaleDateString('en-US', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}</span>
                                    </div>
                                    {form.watch('appointment_time') && (
                                        <div className="flex items-center gap-3 text-sm text-foreground">
                                            <Clock className="h-5 w-5 text-muted-foreground" />
                                            <span>{new Date(`2000-01-01T${form.watch('appointment_time')}`).toLocaleTimeString('en-US', {
                                                hour: 'numeric',
                                                minute: '2-digit',
                                                hour12: true
                                            })}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {form.watch('reason') && (
                                <div className="pt-2">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Reason</h3>
                                    <p className="text-sm text-muted-foreground line-clamp-3">
                                        {form.watch('reason')}
                                    </p>
                                </div>
                            )}

                            {form.watch('consultation_type') && (
                                <div className="pt-4 border-t border-border/40">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Type</h3>
                                    <Badge variant="secondary" className={cn(
                                        "capitalize",
                                        form.watch('consultation_type') === 'video' ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                                    )}>
                                        {form.watch('consultation_type') === 'video' ? 'Video Call' : 'Physical Visit'}
                                    </Badge>
                                </div>
                            )}
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
};
