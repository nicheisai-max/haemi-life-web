import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Video, ShieldCheck, AlertTriangle, MonitorPlay, Wifi, Lock, CheckCircle2, X } from 'lucide-react';
import { telemedicineConsentSchema, type TelemedicineConsentFormData } from '../../lib/validation/legal.schema';

import { SignaturePad } from '@/components/ui/SignaturePad';

export const TelemedicineConsent: React.FC = () => {
    const navigate = useNavigate();

    const form = useForm<TelemedicineConsentFormData>({
        resolver: zodResolver(telemedicineConsentSchema),
        defaultValues: {
            accepted: false,
            signature: '',
        },
    });

    const onSubmit = (data: TelemedicineConsentFormData) => {
        if (data.accepted && data.signature) {
            // Store consent in localStorage
            localStorage.setItem('telemedicine_consent', JSON.stringify({
                status: 'accepted',
                signature: data.signature,
                timestamp: new Date().toISOString()
            }));
            // Navigate to video call or wherever needed
            navigate(-1);
        }
    };

    return (
        <div className="min-h-screen bg-background py-8 px-4">
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
                <div className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Video className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Telemedicine Consultation Consent</h1>
                        <p className="text-muted-foreground mt-2">Please review and accept these terms before your video consultation</p>
                    </div>
                </div>

                <Card className="p-6 md:p-10 space-y-8">
                    <section className="space-y-3">
                        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                            <MonitorPlay className="h-5 w-5 text-primary" />
                            What is Telemedicine?
                        </h2>
                        <p className="text-muted-foreground leading-relaxed pl-7">
                            Telemedicine is the delivery of healthcare services using electronic communications technology,
                            such as video calls. It allows you to consult with healthcare providers remotely.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-primary" />
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
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
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
                            <CheckCircle2 className="h-5 w-5 text-primary" />
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
                            <Lock className="h-5 w-5 text-primary" />
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
                            <Wifi className="h-5 w-5 text-primary" />
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
                            <section className="bg-primary/5 border border-primary/20 rounded-lg p-6 md:p-8 space-y-6">
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
                                                    onSave={(signature) => field.onChange(signature)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                            {field.value && (
                                                <p className="text-xs text-green-600 font-medium flex items-center gap-1 mt-2">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    Signature captured successfully
                                                </p>
                                            )}
                                        </FormItem>
                                    )}
                                />
                            </section>

                            <div className="flex flex-col-reverse sm:flex-row justify-center gap-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => navigate(-1)}
                                    className="flex items-center gap-2 sm:min-w-[150px]"
                                >
                                    <X className="h-4 w-4" />
                                    Decline
                                </Button>
                                <Button
                                    type="submit"
                                    variant="default"
                                    disabled={!form.watch('accepted') || !form.watch('signature')}
                                    className="flex items-center gap-2 sm:min-w-[200px]"
                                >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Accept & Continue
                                </Button>
                            </div>
                        </form>
                    </Form>
                </Card>
            </div>
        </div>
    );
};
