import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getDoctors } from '../../services/doctor.service';
import { bookAppointment, getAvailableSlots } from '../../services/appointment.service';
import { bookAppointmentSchema, type BookAppointmentFormData } from '../../lib/validation/appointment.schema';
import type { DoctorProfile } from '../../services/doctor.service';
import type { AvailableSlots } from '../../services/appointment.service';
import { getConsentStatus } from '../../services/consent.service';
import { getErrorMessage } from '../../lib/error';
import { CheckCircle, AlertTriangle, User, Calendar, Clock, ShieldCheck, ShieldAlert } from 'lucide-react';
import { PremiumLoader } from '@/components/ui/premium-loader';
import { DateScroller } from '@/components/ui/date-scroller';
import { TimeGrid } from '@/components/ui/time-grid';
import { motion, AnimatePresence } from 'framer-motion';
import { TransitionItem } from '@/components/layout/page-transition';

export const BookAppointment: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const preselectedDoctorId = searchParams.get('doctorId');

    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [availableSlots, setAvailableSlots] = useState<AvailableSlots | null>(null);
    const [loading, setLoading] = useState(true);
    const [generalError, setGeneralError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Telemedicine Consent States
    const [hasConsent, setHasConsent] = useState<boolean | null>(null);
    const [showConsentModal, setShowConsentModal] = useState(false);

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
        checkConsent();
    }, []);

    const checkConsent = async () => {
        try {
            const data = await getConsentStatus();
            setHasConsent(data.hasConsent);
        } catch {
            setHasConsent(false);
        }
    };

    useEffect(() => {
        if (preselectedDoctorId && doctors.length > 0) {
            form.setValue('doctor_id', preselectedDoctorId);
        }

        // Restore form data from draft if arriving back from the /consent page
        const draft = sessionStorage.getItem('book_appointment_draft');
        if (draft && doctors.length > 0) {
            try {
                const draftData = JSON.parse(draft);
                if (draftData.doctor_id) form.setValue('doctor_id', draftData.doctor_id);
                if (draftData.appointment_date) form.setValue('appointment_date', draftData.appointment_date);
                if (draftData.appointment_time) form.setValue('appointment_time', draftData.appointment_time);
                if (draftData.reason) form.setValue('reason', draftData.reason);
                form.setValue('consultation_type', 'video');
                // Clean up draft after restoring to avoid sticking state
                sessionStorage.removeItem('book_appointment_draft');
            } catch {
                console.error("Failed to parse appointment draft");
            }
        }
    }, [preselectedDoctorId, doctors, form]);

    const fetchDoctors = async () => {
        try {
            setLoading(true);
            const data = await getDoctors();
            setDoctors(data);
        } catch (err: unknown) {
            setGeneralError(getErrorMessage(err, 'Failed to load doctors'));
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableSlots = useCallback(async () => {
        try {
            const doctorId = watchedDoctorId as string;
            if (!doctorId) return;

            const slots = await getAvailableSlots(doctorId, watchedDate);
            setAvailableSlots(slots);
        } catch (err: unknown) {
            console.error('Failed to fetch slots:', getErrorMessage(err));
            setAvailableSlots(null);
        }
    }, [watchedDoctorId, watchedDate]);

    useEffect(() => {
        if (watchedDoctorId && watchedDate) {
            fetchAvailableSlots();
        }
    }, [watchedDoctorId, watchedDate, fetchAvailableSlots]);

    const onSubmit = async (data: BookAppointmentFormData) => {
        try {
            setGeneralError(null);
            await bookAppointment(data);
            setSuccess(true);
            setTimeout(() => {
                navigate('/appointments');
            }, 2000);
        } catch (err: unknown) {
            setGeneralError(getErrorMessage(err, 'Failed to book appointment'));
        }
    };

    const handleSignConsent = async () => {
        // Save form state to sessionStorage so we can restore it when they come back
        sessionStorage.setItem('book_appointment_draft', JSON.stringify({
            doctor_id: form.getValues('doctor_id'),
            appointment_date: form.getValues('appointment_date'),
            appointment_time: form.getValues('appointment_time'),
            reason: form.getValues('reason'),
        }));

        setShowConsentModal(false);
        navigate('/consent');
    };

    const selectedDoctorData = doctors.find(d => d.id === watchedDoctorId);


    if (success) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Card className="p-12 text-center max-w-lg w-full">
                    <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-6" />
                    <h2 className="text-h2 text-foreground mb-2">Appointment Booked!</h2>
                    <p className="text-muted-foreground mb-4">Your appointment has been successfully scheduled.</p>
                    <p className="text-sm text-muted-foreground">Redirecting to appointments...</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <TransitionItem className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="page-heading !mb-0 transition-all duration-300">Book Appointment</h1>
                    <p className="page-subheading italic text-lg">Schedule a consultation with a healthcare professional</p>
                </div>
            </TransitionItem>

            {generalError && (
                <TransitionItem>
                    <div className="bg-destructive/15 border border-destructive text-destructive p-4 rounded-lg flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5" />
                        {generalError}
                    </div>
                </TransitionItem>
            )}

            <TransitionItem>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 min-w-0">
                    {/* Booking Form */}
                    <div className="min-w-0 lg:col-span-3">
                        <Card className="p-8 h-fit border-none shadow-xl shadow-primary/5 bg-white dark:bg-card ring-1 ring-border/50">
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
                                                        className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-placeholder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                        rows={4}
                                                        placeholder="Describe your symptoms or reason for visit..."
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* --- TELEMEDICINE CONSENT GUARD --- */}
                                    {form.watch('consultation_type') === 'video' && hasConsent === false ? (
                                        <Alert className="border-primary/50 bg-primary/5 shadow-md">
                                            <div className="flex gap-4 items-start">
                                                <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mt-1">
                                                    <ShieldAlert className="h-5 w-5" />
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    <AlertTitle className="text-base font-bold text-foreground m-0">Telemedicine Consent Required</AlertTitle>
                                                    <AlertDescription className="text-sm text-muted-foreground m-0">
                                                        You must review and sign the digital Telemedicine Consultation Consent before booking a continuous video appointment.
                                                    </AlertDescription>
                                                    <Button
                                                        type="button"
                                                        variant="default"
                                                        onClick={() => setShowConsentModal(true)}
                                                        className="mt-3 w-full sm:w-auto shadow-sm"
                                                    >
                                                        <ShieldCheck className="mr-2 h-4 w-4" />
                                                        Review & Sign Consent
                                                    </Button>
                                                </div>
                                            </div>
                                        </Alert>
                                    ) : (
                                        <Button
                                            type="submit"
                                            className="w-full"
                                            size="lg"
                                            disabled={form.formState.isSubmitting}
                                        >
                                            {form.formState.isSubmitting ? (
                                                <>
                                                    <PremiumLoader size="xs" />
                                                    Booking...
                                                </>
                                            ) : (
                                                <>
                                                    <Calendar className="mr-2 h-4 w-4" />
                                                    Book Appointment
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </form>
                            </Form>
                        </Card>
                    </div>

                    {/* Info / Summary Card */}
                    {selectedDoctorData && (
                        <div className="space-y-6 lg:col-span-2">
                            <Card className="p-6 sticky top-24 bg-white dark:bg-card shadow-xl shadow-primary/5 ring-1 ring-border/50">
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
            </TransitionItem>

            {/* Telemedicine Consent Signature Modal */}
            <Dialog open={showConsentModal} onOpenChange={setShowConsentModal}>
                <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden" aria-describedby="consent-terms">
                    <div className="bg-primary/10 p-6 flex items-center gap-4 border-b border-primary/20">
                        <div className="shrink-0 w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/30">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-foreground">Telemedicine Digital Consent</DialogTitle>
                            <DialogDescription className="text-sm text-primary/80 font-medium pt-1">Botswana Digital Healthcare Authority</DialogDescription>
                        </div>
                    </div>

                    <div id="consent-terms" className="p-6 max-h-[60vh] overflow-y-auto space-y-4 text-sm text-muted-foreground leading-relaxed">
                        <p className="font-semibold text-foreground">By proceeding with a video consultation, you acknowledge and agree to the following terms:</p>
                        <ul className="space-y-3 list-disc pl-5">
                            <li><strong>Nature of Telemedicine:</strong> You understand that telemedicine involves the use of electronic communications to enable healthcare providers at different locations to share individual patient medical information for the purpose of improving patient care.</li>
                            <li><strong>Security & Privacy:</strong> The Haemi Life platform utilizes end-to-end encryption. However, you are responsible for ensuring your physical environment is private and secure during the consultation.</li>
                            <li><strong>Limitations:</strong> A video consultation may lack the ability to perform a comprehensive physical examination. If the specialist determines that your condition requires immediate, physical intervention, they will advise you to seek in-person care.</li>
                            <li><strong>Data Retention:</strong> Relevant medical information discussed during the consultation will be recorded in your electronic health record in compliance with the Data Protection Act.</li>
                        </ul>
                        <div className="mt-6 p-4 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50">
                            <p className="text-orange-800 dark:text-orange-300 text-xs font-semibold uppercase tracking-wider mb-1">EMERGENCY NOTICE</p>
                            <p className="text-orange-700 dark:text-orange-400">Do not use telemedicine for medical emergencies. If you are experiencing a life-threatening emergency, call 997 immediately.</p>
                        </div>
                    </div>

                    <DialogFooter className="p-6 border-t bg-muted/30 flex-col sm:flex-row gap-3">
                        <Button type="button" variant="outline" onClick={() => setShowConsentModal(false)} className="w-full sm:w-auto">
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleSignConsent} className="w-full sm:w-auto shadow-md">
                            <ShieldCheck className="mr-2 h-4 w-4" /> I Agree & Sign Consent
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >);
};
