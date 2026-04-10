import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ShieldCheck, AlertTriangle, MonitorPlay, Wifi, Lock, CheckCircle2, X, ArrowLeft, Loader2 } from 'lucide-react';
import { telemedicineConsentSchema, type TelemedicineConsentFormData } from '../../lib/validation/legal.schema';
import { toast } from 'sonner';
import { getErrorMessage } from '../../lib/error';

import { SignaturePad } from '@/components/ui/signature-pad';
import { cn } from '@/lib/utils';
import { PATHS } from '@/routes/paths';
import * as consentService from '../../services/consent.service';
import { MedicalLoader } from '@/components/ui/medical-loader';
import { useAuth } from '@/hooks/use-auth';

export const TelemedicineConsent: React.FC = () => {
    const navigate = useNavigate();
    const { user, refreshUser } = useAuth();
    // 🛡️ INSTITUTIONAL SSOT: Strict Database Truth States
    // If local context knows we lack consent, show form immediately (no flash).
    // If local context says we HAVE consent but we landed here, verify with server first.
    const [isVerifying, setIsVerifying] = React.useState<boolean>(!!user?.hasConsent);

    // 🛡️ MOUNT GUARD: Preventing redundant double-hits to the API
    const hasCheckedRef = React.useRef<boolean>(false);

    React.useEffect(() => {
        if (hasCheckedRef.current) return;
        hasCheckedRef.current = true;

        let isMounted = true;

        const verifyConsentStatus = async () => {
            try {
                // 100% Single Source of Truth: Database via Network
                const dbStatus = await consentService.getConsentStatus();

                if (isMounted) {
                    // HEALING SYNC: If server and local state differ, synchronize the system.
                    if (dbStatus.hasConsent !== user?.hasConsent) {
                        await refreshUser();
                    }

                    setIsVerifying(false);
                }
            } catch {
                // On failure, fail securely to requesting consent
                if (isMounted) {
                    setIsVerifying(false);
                }
            }
        };

        verifyConsentStatus();

        return () => {
            isMounted = false;
        };
    }, [user?.hasConsent, refreshUser]);

    const form = useForm<TelemedicineConsentFormData>({
        resolver: zodResolver(telemedicineConsentSchema),
        defaultValues: {
            accepted: false,
            signature: '',
        },
    });

    const accepted = useWatch({ control: form.control, name: 'accepted' });
    const signature = useWatch({ control: form.control, name: 'signature' });

    // 🩺 GATED RENDER 1: Waiting for Absolute Truth (Fills the Right Panel smoothly)
    if (isVerifying) {
        return <MedicalLoader variant="global" message="Verifying institutional consent..." />;
    }

    // 🩺 GATED RENDER 2: 100% DB confirmed consent -> Handled by TelemedicineGuard
    // Redirection logic removed to prevent mount-loops and ensure SSO.

    const onSubmit = async (data: TelemedicineConsentFormData) => {
        if (data.accepted && data.signature) {
            try {
                // 🩺 HAEMI GLOBAL STATE SYNC
                // 1. Persist the signature to the institutional record table
                await consentService.signConsent(data.signature);

                // 2. Refresh the user profile to ensure user.hasConsent is TRUE system-wide.
                await refreshUser();

                toast.success('Consent signed successfully!', {
                    description: 'Your telemedicine consent has been saved. You can now book video appointments.',
                });

                // Navigate to the Telemedicine Hub.
                navigate(PATHS.TELEMEDICINE, { replace: true });
            } catch (error: unknown) {
                toast.error('Failed to save consent', {
                    description: getErrorMessage(error, 'An error occurred while saving your signature. Please try again.'),
                });
            }
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="group flex items-center gap-2 px-4 py-2 rounded-full bg-card border shadow-sm hover:border-primary/50 transition-all duration-300 active:scale-95"
                >
                    <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={2.5} />
                    <span className="text-sm font-semibold text-muted-foreground group-hover:text-primary transition-colors">Go Back</span>
                </button>
            </div>

            <div className="text-left space-y-4">
                <div>
                    <h1 className="page-heading !mb-0 transition-all duration-300">Telemedicine Consultation Consent</h1>
                    <p className="page-subheading italic">Please review and accept these terms before your video consultation</p>
                </div>
            </div>

            <Card className="p-6 md:p-10 space-y-8">
                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                        <MonitorPlay className="h-5 w-5 text-primary" strokeWidth={2.5} />
                        What is Telemedicine?
                    </h2>
                    <p className="text-muted-foreground leading-relaxed pl-7">
                        Telemedicine is the delivery of healthcare services using electronic communications technology,
                        such as video calls. It allows you to consult with healthcare providers remotely.
                    </p>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" strokeWidth={2.5} />
                        Benefits of Telemedicine
                    </h2>
                    <ul className="list-disc pl-11 space-y-2 text-muted-foreground">
                        <li>Convenient access to healthcare from your location</li>
                        <li>Reduced travel time and costs</li>
                        <li>Access to specialists who may not be locally available</li>
                        <li>Continuity of care during illness or mobility limitations</li>
                    </ul>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-600" strokeWidth={2.5} />
                        Limitations and Risks
                    </h2>
                    <p className="text-muted-foreground pl-7 mb-2">By accepting this consent, you acknowledge the following limitations:</p>
                    <ul className="list-disc pl-11 space-y-2 text-muted-foreground">
                        <li>
                            <strong className="text-foreground">Physical Examination:</strong> The doctor cannot perform a physical examination
                            and may not be able to detect certain conditions that require in-person assessment.
                        </li>
                        <li>
                            <strong className="text-foreground">Technology Issues:</strong> Technical difficulties (poor internet, audio/video
                            problems) may disrupt the consultation.
                        </li>
                        <li>
                            <strong className="text-foreground">Emergency Care:</strong> Telemedicine is NOT appropriate for medical emergencies.
                            In case of emergency, call 911 or go to the nearest emergency room.
                        </li>
                        <li>
                            <strong className="text-foreground">Diagnostic Limitations:</strong> Some conditions cannot be diagnosed remotely
                            and may require an in-person visit.
                        </li>
                        <li>
                            <strong className="text-foreground">Network Security:</strong> While we use encrypted connections, there is always
                            a small risk of privacy breach with electronic communications.
                        </li>
                    </ul>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" strokeWidth={2.5} />
                        Your Responsibilities
                    </h2>
                    <p className="text-muted-foreground pl-7 mb-2">As a patient using telemedicine services, you agree to:</p>
                    <ul className="list-disc pl-11 space-y-2 text-muted-foreground">
                        <li>Provide accurate and complete medical information</li>
                        <li>Be in a private, quiet location for your consultation</li>
                        <li>Have adequate internet connectivity and a working camera/microphone</li>
                        <li>Follow your doctor's recommendations and instructions</li>
                        <li>Understand that the doctor may recommend an in-person visit if necessary</li>
                    </ul>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                        <Lock className="h-5 w-5 text-primary" strokeWidth={2.5} />
                        Privacy and Confidentiality
                    </h2>
                    <div className="space-y-3 pl-7">
                        <p className="text-muted-foreground leading-relaxed">
                            Your telemedicine consultation is confidential and protected by the same privacy laws that
                            apply to in-person visits. Your medical information will not be shared without your consent,
                            except as required by law.
                        </p>
                        <p className="text-muted-foreground leading-relaxed">
                            Video consultations are conducted through secure, encrypted connections. We do not record
                            sessions unless you explicitly consent for educational or quality purposes.
                        </p>
                    </div>
                </section>

                <section className="space-y-3">
                    <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                        <Wifi className="h-5 w-5 text-primary" strokeWidth={2.5} />
                        Technical Requirements
                    </h2>
                    <p className="text-muted-foreground pl-7 mb-2">For the best telemedicine experience, ensure you have:</p>
                    <ul className="list-disc pl-11 space-y-2 text-muted-foreground">
                        <li>A device with a working camera and microphone</li>
                        <li>Stable internet connection (minimum 1 Mbps recommended)</li>
                        <li>Updated web browser (Chrome, Firefox, Safari, or Edge)</li>
                        <li>A quiet, well-lit environment for your consultation</li>
                    </ul>
                </section>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <section className="bg-primary/5 border border-primary/20 rounded-[var(--card-radius)] p-6 md:p-8 space-y-6">
                            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-primary" />
                                Consent Declaration
                            </h2>
                            <p className="text-muted-foreground">
                                By checking the box below and providing your signature, I acknowledge that:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-muted-foreground text-sm">
                                <li>I have read and understood this consent form</li>
                                <li>I have had the opportunity to ask questions</li>
                                <li>I understand the benefits and limitations of telemedicine</li>
                                <li>I consent to receive healthcare services via telemedicine</li>
                                <li>I understand this is not for emergency situations</li>
                            </ul>

                            <FormField
                                control={form.control}
                                name="accepted"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-4 border-t border-primary/10">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <div className="grid gap-1.5 leading-none">
                                            <FormLabel className="text-sm font-medium leading-none cursor-pointer">
                                                I have read, understood, and agree to the telemedicine consent terms
                                            </FormLabel>
                                            <FormMessage />
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="signature"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Digital Signature</FormLabel>
                                        <FormControl>
                                            <SignaturePad
                                                value={field.value}
                                                onSave={(signature) => field.onChange(signature)}
                                                onClear={() => field.onChange('')}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </section>

                        <div className="flex flex-col-reverse sm:flex-row justify-center gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate(-1)}
                                className="flex items-center justify-center gap-2 sm:min-w-40 h-11 text-base rounded-[var(--card-radius)] font-medium transition-all duration-300"
                            >
                                <X className="h-4 w-4" />
                                Decline
                            </Button>
                            <Button
                                type="submit"
                                variant="default"
                                disabled={!accepted || !signature || form.formState.isSubmitting}
                                className={cn(
                                    "flex items-center justify-center gap-2 sm:min-w-52 h-11 text-base rounded-[var(--card-radius)] font-medium transition-all duration-500",
                                    accepted && signature
                                        ? "bg-gradient-to-r from-primary to-teal-600 hover:from-primary/90 hover:to-teal-700 shadow-lg shadow-primary/20 hover:-translate-y-0.5 animate-in slide-in-from-bottom-2 fade-in border border-transparent"
                                        : "border border-transparent"
                                )}
                            >
                                {form.formState.isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Finalizing...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        Accept & Continue
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </Card>
        </div>
    );
};
